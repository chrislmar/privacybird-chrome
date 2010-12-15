/*
 * SITES TESTED for validity:
 *   Valid:
 *   www.cbssports.com
 *   www.espn.com
 *   www.lorrie.cranor.org
 *   www.microsoft.com
 *   www.w3.org
 *   search.yahoo.com
 *   www.overstock.com
 *
 *   Invalid:
 *   www.netflix.com (only on new request, actually DNE)
 *
 *   Unsupported: (i.e. incompatible b/c of weird bugs)
 *   msdn.microsoft.com/en-us/default.aspx
 *   amazon.com
 *   usps.com
 *   dell.com
 *   att.com
 */

/**
 * NOTES:
 *   - multiple windows is an unsupported feature
 *   - re-evaluates for nutrition label page
 */

var min_load_time = 100; // ms
// TODO how to handle bad internet connection?
var xhr_timeout = 20000; // ms

/***** Listener for Popup Request *****/
chrome.extension.onRequest.addListener(
    function(request, sender, sendRequest) {
        if (request.arg != 'refresh') {
            return;
        }
        var tabId = localStorage["current_tab_id"];
        var url = localStorage["current_tab_url"];
        if (tabId != null && tabId != undefined &&
            url != null   && url != undefined) {

            // remove from cache(s)
            if (cache_dne_lookup(url) == 0) { // in DNE cache
                var idx = -1;
                var cache = localStorage["cache_dne"].split(";");
                for (i = 0; i < cache.length; i++) {
                    if (cache[i] == url) {
                        idx = i;
                        break;
                    }
                }
                cache.splice(idx, 1);
                if (cache.length == 0) {
                    localStorage.removeItem("cache_dne");
                } else {
                    localStorage["cache_dne"] = cache.join(";");
                }
            } else if (cache_url_lookup(url) != 'null') { // in url cache
                var idx = -1;
                var cache = localStorage["cache_url"].split(";");
                var xml = "";
                for (i = 0; i < cache.length; i++) {
                    var obj = JSON.parse(cache[i]);
                    if (obj.url == url) {
                        idx = i;
                        // remove xml from valid/invalid caches
                        var type = cache_xml_lookup(obj.xml);
                        if (type == 0) { // valid cache
                            var cache_valid = localStorage["cache_valid"].split(";");
                            for (i = 0; i < cache_valid.length; i++) {
                                if (cache_valid[i] == obj.xml) {
                                    cache_valid.splice(i, 1);
                                    break;
                                }
                            }
                            if (cache_valid.length == 0) {
                                localStorage.removeItem("cache_valid");
                            } else {
                                localStorage["cache_valid"] = cache_valid.join(";");
                            }
                        } else if (type == 1) { // invalid cache
                            var cache_invalid = localStorage["cache_invalid"].split(";");
                            for (i = 0; i < cache_invalid.length; i++) {
                                if (cache_invalid[i] == obj.xml) {
                                    cache_invalid.splice(i, 1);
                                    break;
                                }
                            }
                            if (cache_invalid.length == 0) {
                                localStorage.removeItem("cache_invalid");
                            } else {
                                localStorage["cache_invalid"] = cache_invalid.join(";");
                            }
                        }
                        break;
                    }
                }
                cache.splice(idx, 1);
                if (cache.length == 0) {
                    localStorage.removeItem("cache_url");
                } else {
                    localStorage["cache_url"] = cache.join(";");
                }
            }

            eval_reset();
            p3p_update(url, parseInt(tabId));
        }
    });
/***** End Popup Listener *****/


// triggered whenever a new tab is selected
chrome.tabs.onSelectionChanged.addListener(
    function(tabId) {
        chrome.tabs.get(tabId, 
            function(tab) {
                if (tab == null || tab == undefined) {
                    return;
                }

                var url = removeAnchor(tab.url);
                
                localStorage["current_tab_id"] = tabId;

                if (localStorage["current_tab_url"] == null      || 
                    localStorage["current_tab_url"] == undefined || 
                    localStorage["current_tab_url"] != url) {
                    localStorage["current_tab_url"] = url;
                    eval_reset();
                    p3p_update(url, tab.id);
                }
            }
        );
    }
);

// triggered whenever something changes in the current tab
chrome.tabs.onUpdated.addListener(
    function(tabId, changeInfo, tab) {
        // trigger for 'loading' and NOT 'complete'
        if (changeInfo.status == "loading") {

            var url = removeAnchor(tab.url);

            if (localStorage["current_tab_id"] == tabId) {
                if (localStorage["current_tab_url"] == null      || 
                    localStorage["current_tab_url"] == undefined || 
                    localStorage["current_tab_url"] != url) {
                    localStorage["current_tab_url"] = url;
                    eval_reset();
                    p3p_update(url, tab.id);
                }
            }
        }
    }
);

function p3p_update(url, tabId) {
    if (localStorage["current_tab_id"] != tabId || 
        localStorage["current_tab_url"] != url) {
        return;
    }

    startAnimate();
    chrome.browserAction.setPopup({tabId: tabId, popup: ''});
    chrome.browserAction.setBadgeText({ text: "" });

    // check for http*
    if (url.substring(0,4) != 'http') {
        stopAnimate();
        setIcon('gray');
        return;
    }

    setTimeout( function() {
        var xml = cache_url_lookup(url);
        if (xml != 'null') { // in url cache
            console.log("found in URL cache: "+xml);
            var ret = cache_xml_lookup(xml);
            switch(ret) {
                case 0: // in valid cache
                    console.log("URL case 0: VALID cache");
                    p3p_user_eval(xml, tabId, url)
                    break;
                case 1: // in invalid cache
                    console.log("URL case 1: INVALID cache");
                    localStorage["trigger_count"] = -2;
                    setInvalid(tabId, url);
                    cache_invalid_add(xml);
                    cache_url_add(url, xml);
                    break;
                default: // not in cache(s)
                    console.log("URL case -1: not in cache(s)");
                    p3p_is_valid(xml, tabId, url);
                    break;
            }
            return;
        }

        // look in DNE cache
        if (cache_dne_lookup(url) == 0) { // in DNE cache
            setUnknown(tabId, url);
            return;
        }

        var xhr = $.ajax({
            async: true,
            cache: false,
            type: "GET",
            url: "http://validator.privacyfinder.org/p3p/20020128/p3p.pl?uri="+url,
            dataType: "html",
            timeout: xhr_timeout,
            success: function(html, status) {
                var p3pUrl = "";
                $(html).filter("p.result").each( function() {
                    var str = $(this).text();
                    // match beginning of str with "P3P policy for"
                    if (str.search("P3P policy for*") != -1) {
                        var begin = str.indexOf("[");
                        var end = str.lastIndexOf("]");
                        p3pUrl = str.slice(begin+1, end);
                    }
                });
                if (p3pUrl != "") {
                    var ret = cache_xml_lookup(p3pUrl);
                    switch(ret) {
                        case 0: // in valid cache
                            console.log("case 0: VALID cache");
                            p3p_user_eval(p3pUrl, tabId, url)
                            break;
                        case 1: // in invalid cache
                            console.log("case 1: INVALID cache");
                            localStorage["trigger_count"] = -2;
                            setInvalid(tabId, url);
                            cache_invalid_add(p3pUrl);
                            cache_url_add(url, p3pUrl);
                            break;
                        default: // not in cache(s)
                            console.log("case -1: not in cache(s)");
                            p3p_is_valid(p3pUrl, tabId, url);
                            break;
                    }
                } else {
                    // unknown
                    setUnknown(tabId, url);
                    cache_dne_add(url);
                }
            },
            error: function(xhr, status) {
                setDisabled(tabId, url);
            },
        });
    }, min_load_time); 
}

// takes URL of XML file
function p3p_is_valid(p3pUrl, tabId, url) {
    if (localStorage["current_tab_id"] != tabId || 
        localStorage["current_tab_url"] != url) {
        return;
    }

    chrome.browserAction.setPopup({tabId: tabId, popup: ''});
    chrome.browserAction.setBadgeText({ text: "" });

    var xhr = $.ajax({
        async: true,
        cache: false,
        type: "GET",
        url: "http://validator.privacyfinder.org/p3p/20020128/policy.pl?uri="+p3pUrl,
        dataType: "html",
        timeout: xhr_timeout,
        success: function(html, status) {
            var count = 0;
            $(html).filter('p.result2').find('font[color=blue]').each( function() {
                var str = $(this).text();
                if (str.search("no syntax errors") != -1) {
                    count++;
                } else if (str.search("no vocabulary errors") != -1) {
                    count++;
                } else if (str.search("no link errors") != -1) {
                    count++;
                }
            });
            // XXX >= 2
            if (count >= 3) { // valid P3P policy
                p3p_user_eval(p3pUrl, tabId, url);
            } else { // invalid
                localStorage["trigger_count"] = -2;
                setInvalid(tabId, url);

                // cache invalid policy
                cache_invalid_add(p3pUrl);
                cache_url_add(url, p3pUrl);
            }
        },
        error: function(xhr, status) {
            setDisabled(tabId, url);
        },
    });
}

var boolIdArray = new Array("hmi_0", "hmi_1", "fpi_0", "fpi_1", "pii_0", "pii_1", "pii_2", "pii_3", "pii_4", "pii_5", "nii_0", "nii_1");

/**
 * Notes for translating preferences to P3P elements:
 * http://www.privacybird.org/help/help-privacypreferencesettings.html
 */

function p3p_user_eval(p3pUrl, tabId, url) {
    if (localStorage["current_tab_id"] != tabId || 
        localStorage["current_tab_url"] != url) {
        return;
    }

    var count = 0;

    localStorage["current_anchor"] = getAnchor(p3pUrl);

    var xhr = $.ajax({
        async: true,
        cache: false,
        type: "GET",
        url: p3pUrl,
        dataType: "xml",
        timeout: xhr_timeout,
        success: function(xml, status) {

            if (localStorage["gc_hmi_0"] == 'true' && 
                eval_hmi_0(xml) == true) {
                count++;
                localStorage["trigger_hmi_0"] = 'true';
            } else {
                localStorage["trigger_hmi_0"] = 'false';
            }

            if (localStorage["gc_hmi_1"] == 'true' && 
                eval_hmi_1(xml) == true) {
                count++;
                localStorage["trigger_hmi_1"] = 'true';
            } else {
                localStorage["trigger_hmi_1"] = 'false';
            }
            
            if (localStorage["gc_fpi_0"] == 'true' && 
                eval_fpi_0(xml) == true) {
                count++;
                localStorage["trigger_fpi_0"] = 'true';
            } else {
                localStorage["trigger_fpi_0"] = 'false';
            }

            if (localStorage["gc_fpi_1"] == 'true' &&
                eval_fpi_1(xml) == true) {
                count++;
                localStorage["trigger_fpi_1"] = 'true';
            } else {
                localStorage["trigger_fpi_1"] = 'false';
            }

            if (localStorage["gc_pii_0"] == 'true' &&
                eval_pii_0(xml) == true) {
                count++;
                localStorage["trigger_pii_0"] = 'true';
            } else {
                localStorage["trigger_pii_0"] = 'false';
            }
            
            if (localStorage["gc_pii_1"] == 'true' &&
                eval_pii_1(xml) == true) {
                count++;
                localStorage["trigger_pii_1"] = 'true';
            } else {
                localStorage["trigger_pii_1"] = 'false';
            }

            if (localStorage["gc_pii_2"] == 'true' && 
                eval_pii_2(xml) == true) {
                count++;
                localStorage["trigger_pii_2"] = 'true';
            } else {
                localStorage["trigger_pii_2"] = 'false';
            }
            
            if (localStorage["gc_pii_3"] == 'true' &&
                eval_pii_3(xml) == true) {
                count++;
                localStorage["trigger_pii_3"] = 'true';
            } else {
                localStorage["trigger_pii_3"] = 'false';
            }
            
            if (localStorage["gc_pii_4"] == 'true' &&
                eval_pii_4(xml) == true) {
                count++;
                localStorage["trigger_pii_4"] = 'true';
            } else {
                localStorage["trigger_pii_4"] = 'false';
            }

            if (localStorage["gc_pii_5"] == 'true' &&
                eval_pii_5(xml) == true) {
                count++;
                localStorage["trigger_pii_5"] = 'true';
            } else {
                localStorage["trigger_pii_5"] = 'false';
            }

            if (localStorage["gc_nii_0"] == 'true' &&
                eval_nii_0(xml) == true) {
                count++;
                localStorage["trigger_nii_0"] = 'true';
            } else {
                localStorage["trigger_nii_0"] = 'false';
            }

            if (localStorage["gc_nii_1"] == 'true' &&
                eval_nii_1(xml) == true) {
                count++;
                localStorage["trigger_nii_1"] = 'true';
            } else {
                localStorage["trigger_nii_1"] = 'false';
            }

            if (eval_other_purposes(xml) == true) {
                count++;
                localStorage["trigger_other"] = 'true';
            } else {
                localStorage["trigger_other"] = 'false';
            }

            localStorage["trigger_count"] = count;

            eval_categories(xml);
            eval_purposes(xml);
            eval_recipients(xml);
            eval_access(xml);
            eval_contact(xml);
            eval_disputes(xml);
            eval_discuri(xml);

            if (count == 0) {
                if (localStorage["current_tab_id"] != tabId || 
                    localStorage["current_tab_url"] != url) {
                    return;
                }
                setMatch(tabId, url);
                
                // cache matching policy
                cache_valid_add(p3pUrl);
                cache_url_add(url, p3pUrl);

            } else {
                if (localStorage["current_tab_id"] != tabId || 
                    localStorage["current_tab_url"] != url) {
                    return;
                }
                setUnmatch(tabId, url, count);

                // cache unmatching policy
                cache_valid_add(p3pUrl);
                cache_url_add(url, p3pUrl);
            }
        },
        error: function(xhr, status) {
            setUnknown(tabId, url);
        },
    });
}

function eval_hmi_0(xml) {

    // health category
    // purpose = pseudo-analysis/decision, individual-analysis/decision,
    //           contact, telemarketing XXX tailoring?
    //           with required = always, opt-out

    var flag = false;

    var anchor = localStorage["current_anchor"];
    var stmt;
    if (anchor != 'null') {
        stmt = 'POLICY[name="'+anchor+'"] STATEMENT';
    } else {
        stmt = 'STATEMENT';
    }
    
    $(xml).find(stmt).each( function() {
        if ($(this).find('DATA-GROUP DATA[ref="#dynamic.miscdata"] health').length) {
            if ($(this).find('PURPOSE pseudo-analysis[required!="opt-in"]').length ||
                $(this).find('PURPOSE pseudo-decision[required!="opt-in"]').length ||
                $(this).find('PURPOSE individual-analysis[required!="opt-in"]').length ||
                $(this).find('PURPOSE individual-decision[required!="opt-in"]').length ||
                $(this).find('PURPOSE contact[required!="opt-in"]').length ||
                $(this).find('PURPOSE telemarketing[required!="opt-in"]').length ) {
                flag = true;
            }
        }
    });
    return flag;
}

function eval_hmi_1(xml) {

    // health category
    // recipient = same, other-recipient, unrelated, public XXX delivery?
    //           with required = always, opt-out
    
    var flag = false;

    var anchor = localStorage["current_anchor"];
    var stmt;
    if (anchor != 'null') {
        stmt = 'POLICY[name="'+anchor+'"] STATEMENT';
    } else {
        stmt = 'STATEMENT';
    }
    
    $(xml).find(stmt).each( function() {
        if ($(this).find('DATA-GROUP DATA[ref="#dynamic.miscdata"] health').length) {
            if ($(this).find('RECIPIENT same[required!="opt-in"]').length ||
                $(this).find('RECIPIENT other-recipient[required!="opt-in"]').length ||
                $(this).find('RECIPIENT unrelated[required!="opt-in"]').length ||
                $(this).find('RECIPIENT public[required!="opt-in"]').length ) {
                flag = true;
            }
        }
    });
    return flag;
}

function eval_fpi_0(xml) {

    // purchase or financial category
    // purpose = pseudo-analysis/decision, individual-analysis/decision,
    //           contact, telemarketing XXX tailoring?
    //           with required = always, opt-out

    var flag = false;

    var anchor = localStorage["current_anchor"];
    var stmt;
    if (anchor != 'null') {
        stmt = 'POLICY[name="'+anchor+'"] STATEMENT';
    } else {
        stmt = 'STATEMENT';
    }
    
    $(xml).find(stmt).each( function() {
        if ($(this).find('DATA-GROUP DATA[ref="#dynamic.miscdata"] financial').length ||
            $(this).find('DATA-GROUP DATA[ref="#dynamic.miscdata"] purchase').length ) {
            if ($(this).find('PURPOSE pseudo-analysis[required!="opt-in"]').length ||
                $(this).find('PURPOSE pseudo-decision[required!="opt-in"]').length ||
                $(this).find('PURPOSE individual-analysis[required!="opt-in"]').length ||
                $(this).find('PURPOSE individual-decision[required!="opt-in"]').length ||
                $(this).find('PURPOSE contact[required!="opt-in"]').length ||
                $(this).find('PURPOSE telemarketing[required!="opt-in"]').length ) {
                flag = true;
            }
        }
    });
    return flag;
}

function eval_fpi_1(xml) {

    // purchase or financial category
    // recipient = same, other-recipient, unrelated, public XXX delivery?
    //           with required = always, opt-out
    
    var flag = false;

    var anchor = localStorage["current_anchor"];
    var stmt;
    if (anchor != 'null') {
        stmt = 'POLICY[name="'+anchor+'"] STATEMENT';
    } else {
        stmt = 'STATEMENT';
    }
    
    $(xml).find(stmt).each( function() {
        if ($(this).find('DATA-GROUP DATA[ref="#dynamic.miscdata"] financial').length ||
            $(this).find('DATA-GROUP DATA[ref="#dynamic.miscdata"] purchase').length ) {
            if ($(this).find('RECIPIENT same[required!="opt-in"]').length ||
                $(this).find('RECIPIENT other-recipient[required!="opt-in"]').length ||
                $(this).find('RECIPIENT unrelated[required!="opt-in"]').length ||
                $(this).find('RECIPIENT public[required!="opt-in"]').length ) {
                flag = true;
            }
        }
    });
    return flag;
}

function eval_pii_0(xml) {

    // purpose = telemarketing with required = always, opt-out

    var flag = false;

    var anchor = localStorage["current_anchor"];
    var stmt;
    if (anchor != 'null') {
        stmt = 'POLICY[name="'+anchor+'"] STATEMENT';
    } else {
        stmt = 'STATEMENT';
    }
    
    $(xml).find(stmt).each( function() {
        if ($(this).find('PURPOSE telemarketing[required!="opt-in"]').length) {
            flag = true;
        }
    });
    return flag;
}

function eval_pii_1(xml) {

    // purpose = contact with required = always, opt-out

    var flag = false;

    var anchor = localStorage["current_anchor"];
    var stmt;
    if (anchor != 'null') {
        stmt = 'POLICY[name="'+anchor+'"] STATEMENT';
    } else {
        stmt = 'STATEMENT';
    }
    
    $(xml).find(stmt).each( function() {
        if ($(this).find('PURPOSE contact[required!="opt-in"]').length) {
            flag = true;
        }
    });
    return flag;
}

function eval_pii_2(xml) {

    // purpose = telemarketing, contact with required = always
    // XXX but isn't required=always default?

    var flag = false;

    var anchor = localStorage["current_anchor"];
    var stmt;
    if (anchor != 'null') {
        stmt = 'POLICY[name="'+anchor+'"] STATEMENT';
    } else {
        stmt = 'STATEMENT';
    }
    
    $(xml).find(stmt).each( function() {
        if ($(this).find('PURPOSE telemarketing[required="always"]').length || 
            $(this).find('PURPOSE contact[required="always"]').length) {
            flag = true;
        }
    });
    return flag;
}

function eval_pii_3(xml) {

    // purpose = individual-analysis/decision with required = always, out

    var flag = false;

    var anchor = localStorage["current_anchor"];
    var stmt;
    if (anchor != 'null') {
        stmt = 'POLICY[name="'+anchor+'"] STATEMENT';
    } else {
        stmt = 'STATEMENT';
    }
    
    $(xml).find(stmt).each( function() {
        if ($(this).find('PURPOSE individual-analysis[required!="opt-in"]').length || 
            $(this).find('PURPOSE individual-decision[required!="opt-in"]').length) {
            flag = true;
        }
    });
    return flag;
}

function eval_pii_4(xml) {

    // physical, online, government categories
    // recipient = same, other-recipient, unrelated, public
    //             with required = always, opt-out

    var flag = false;

    var anchor = localStorage["current_anchor"];
    var stmt;
    if (anchor != 'null') {
        stmt = 'POLICY[name="'+anchor+'"] STATEMENT';
    } else {
        stmt = 'STATEMENT';
    }
    
    $(xml).find(stmt).each( function() {
        if ($(this).find('DATA-GROUP DATA[ref=#dynamic.miscdata] physical').length   || 
            $(this).find('DATA-GROUP DATA[ref=#dynamic.miscdata] online').length     || 
            $(this).find('DATA-GROUP DATA[ref=#dynamic.miscdata] government').length || 
            $(this).find('DATA-GROUP DATA[ref*=#user.name]').length                   ||
            $(this).find('DATA-GROUP DATA[ref*=#user.bdate]').length                  ||
            $(this).find('DATA-GROUP DATA[ref*=#user.home-info]').length              ||
            $(this).find('DATA-GROUP DATA[ref*=#user.business-info]').length          ||
            $(this).find('DATA-GROUP DATA[ref*=#thirdparty.name]').length             ||
            $(this).find('DATA-GROUP DATA[ref*=#thirdparty.bdate]').length            ||
            $(this).find('DATA-GROUP DATA[ref*=#thirdparty.home-info]').length        ||
            $(this).find('DATA-GROUP DATA[ref*=#thirdparty.business-info]').length  ) {
            if ($(this).find('RECIPIENT same[required!="opt-in"]').length ||
                $(this).find('RECIPIENT other-recipient[required!="opt-in"]').length ||
                $(this).find('RECIPIENT unrelated[required!="opt-in"]').length ||
                $(this).find('RECIPIENT public[required!="opt-in"]').length ) {
                flag = true;
            }
        }
    });
    return flag;
}

function eval_pii_5(xml) {

    // <ACCESS><none/></ACCESS>

    var anchor = localStorage["current_anchor"];
    var access;
    if (anchor != 'null') {
        access = 'POLICY[name="'+anchor+'"] ACCESS';
    } else {
        access = 'ACCESS';
    }
    
    if ($(xml).find(access+' none').length) {
        return true;
    }
    return false;
}

function eval_nii_0(xml) {

    // purpose = pseudo-analysis/decision with required = always, out

    var anchor = localStorage["current_anchor"];
    var stmt;
    if (anchor != 'null') {
        stmt = 'POLICY[name="'+anchor+'"] STATEMENT';
    } else {
        stmt = 'STATEMENT';
    }

    if ($(xml).find(stmt+' PURPOSE pseudo-analysis[required!="opt-in"]').length ||
        $(xml).find(stmt+' PURPOSE pseudo-decision[required!="opt-in"]').length) {
        return true;
    }
    return false;
}

function eval_nii_1(xml) {

    // recipient = same, other-recipient, unrelated, public
    //             with required = always, opt-out

    var anchor = localStorage["current_anchor"];
    var stmt;
    if (anchor != 'null') {
        stmt = 'POLICY[name="'+anchor+'"] STATEMENT';
    } else {
        stmt = 'STATEMENT';
    }
    
    if ($(xml).find(stmt+' RECIPIENT same[required!="opt-in"]').length ||
        $(xml).find(stmt+' RECIPIENT other-recipient[required!="opt-in"]').length ||
        $(xml).find(stmt+' RECIPIENT unrelated[required!="opt-in"]').length ||
        $(xml).find(stmt+' RECIPIENT public[required!="opt-in"]').length) {
        return true;
    }
    return false;
}

function eval_other_purposes(xml) {

    // purpose = other-purpose

    var anchor = localStorage["current_anchor"];
    var stmt;
    if (anchor != 'null') {
        stmt = 'POLICY[name="'+anchor+'"] STATEMENT';
    } else {
        stmt = 'STATEMENT';
    }
    
    if ($(xml).find(stmt+' PURPOSE other-purpose').length) {
        return true;
    }
    return false;
}

function eval_categories(xml) {

    // look for all present categories

    var anchor = localStorage["current_anchor"];
    var stmt;
    if (anchor != 'null') {
        stmt = 'POLICY[name="'+anchor+'"] STATEMENT';
    } else {
        stmt = 'STATEMENT';
    }

    var userArray = new Array('name', 'bdate', 'cert', 'gender', 'employer',
                              'department', 'jobtitle', 'home-info',
                              'business-info', 'login');

    for (var i in userArray) {
        var id = userArray[i];
        if ($(xml).find(stmt+' DATA-GROUP DATA[ref*="#user.'+id+'"]').length)
            localStorage["cat_user_"+id] = 'true';
        if ($(xml).find(stmt+' DATA-GROUP DATA[ref*="#thirdparty.'+id+'"]').length)
            localStorage["cat_third_"+id] = 'true';
    }

    var dynArray = new Array('clickstream', 'http', 'clientevents', 'cookies',
                             'searchtext', 'interactionrecord');

    for (var i in dynArray) {
        var id = dynArray[i];
        if ($(xml).find(stmt+' DATA-GROUP DATA[ref=*"#dynamic.'+id+'"]').length)
            localStorage["cat_dyn_"+id] = 'true';
    }

    var catArray = new Array('physical', 'online', 'uniqueid', 'purchase',
                             'financial', 'computer', 'navigation',
                             'interactive', 'demographic', 'content', 'state',
                             'political', 'health', 'preference', 'location',
                             'government', 'other-category');

    for (var i in catArray) {
        var id = catArray[i];
        if ($(xml).find(stmt+' DATA-GROUP DATA[ref="#dynamic.miscdata"] CATEGORIES '+id).length)
            localStorage["cat_"+id] = 'true';
        if (id == 'other-category' && localStorage["cat_other-category"] == 'true') {
            localStorage["cat_other-category_str"] = $(xml).find(stmt+' DATA-GROUP DATA CATEGORIES other-category').text();
            console.log("other-category_str: "+localStorage["cat_other-category_str"]);
        }
    }
}

function eval_purposes(xml) {

    // search for all purposes

    var anchor = localStorage["current_anchor"];
    var stmt;
    if (anchor != 'null') {
        stmt = 'POLICY[name="'+anchor+'"] STATEMENT';
    } else {
        stmt = 'STATEMENT';
    }

    var purpArray = new Array('current', 'admin', 'develop', 'tailoring',
                              'pseudo-analysis', 'pseudo-decision',
                              'individual-analysis', 'individual-decision',
                              'contact', 'telemarketing', 'historical',
                              'other-purpose');

    for (var i in purpArray) {
        var id = purpArray[i];
        if ($(xml).find(stmt+' PURPOSE '+id).length)
            localStorage["purp_"+id] = 'true';
        if (id == 'other-purpose' && localStorage["purp_other-purpose"] == 'true') {
            localStorage["purp_other-purpose_str"] = $(xml).find(stmt+' PURPOSE other-purpose').text();
            console.log("other-purpose_str: "+localStorage["purp_other-purpose_str"]);
        }
    }
}

function eval_recipients(xml) {

    // search for all recipients

    var anchor = localStorage["current_anchor"];
    var stmt;
    if (anchor != 'null') {
        stmt = 'POLICY[name="'+anchor+'"] STATEMENT';
    } else {
        stmt = 'STATEMENT';
    }

    var recArray = new Array('ours', 'delivery', 'same', 'other-recipient',
                             'unrelated', 'public');

    for (var i in recArray) {
        var id = recArray[i];
        if ($(xml).find(stmt+' RECIPIENT '+id).length)
            localStorage["rec_"+id] = 'true';
    }
}

function eval_contact(xml) {

    // search for all business contact information

    var count = 0;

    var anchor = localStorage["current_anchor"];
    var ent;
    if (anchor != 'null') {
        ent = 'POLICY[name="'+anchor+'"] ENTITY';
    } else {
        ent = 'ENTITY';
    }

    var entArray = new Array('name', 'contact-info.postal.street',
                             'contact-info.postal.city', 
                             'contact-info.postal.stateprov',
                             'contact-info.postal.postalcode',
                             'contact-info.postal.country',
                             'contact-info.postal.organization',
                             'contact-info.online.email',
                             'contact-info.online.uri',
                             'contact-info.telecom.telephone.number');

    for (var i in entArray) {
        var id = entArray[i];
        if ($(xml).find(ent+' DATA-GROUP DATA[ref="#business.'+id+'"]').length) {
            localStorage["ent_"+id] = $(xml).find(ent+' DATA-GROUP DATA[ref="#business.'+id+'"]').text();
            count++;
        }
    }

    localStorage["contact_count"] = count;
}

function eval_access(xml) {

    // find <ACCESS>

    var count = 0;

    var anchor = localStorage["current_anchor"];
    var access;
    if (anchor != 'null') {
        access = 'POLICY[name="'+anchor+'"] ACCESS';
    } else {
        access = 'ACCESS';
    }

    var accessArray = ('nonident', 'all', 'contact-and-other',
                       'ident-contact', 'other-ident', 'none');

    for (var i in accessArray) {
        var id = accessArray[i];
        if ($(xml).find(access+' '+id).length) {
            localStorage["access_"+id] = 'true';
            count++;
        }
    }

    localStorage["access_count"] = count;;
}

function eval_disputes(xml) {

    // search for dispute resolution information

    var count = 0;

    var anchor = localStorage["current_anchor"];
    var disp;
    if (anchor != 'null') {
        disp = 'POLICY[name="'+anchor+'"] DISPUTES-GROUP';
    } else {
        disp = 'DISPUTES-GROUP';
    }

    var arrResType = new Array();
    var arrService = new Array();
    var arrShort   = new Array();
    var arrLong    = new Array();

    // for each DISPUTES-GROUP
    $(xml).find(disp).each( function() {
        // for each DISPUTES
        $(this).find('DISPUTES').each( function() {
            count++;
            arrResType.push($(this).attr('resolution-type'));
            arrService.push($(this).attr('service'));
            arrShort.push($(this).attr('short-description'));
            arrLong.push(trim($(this).find('LONG-DESCRIPTION').text()));
        });
    });

    localStorage["disp_count"] = count;

    arrResType.push('null');

    localStorage.setItem("disp_type",  arrResType.join(";"));
    localStorage.setItem("disp_serv",  arrService.join(";"));
    localStorage.setItem("disp_short", arrShort.join(";"));
    localStorage.setItem("disp_long",  arrLong.join(";"));
}

function eval_discuri(xml) {

    // search for discuri

    var anchor = localStorage["current_anchor"];
    var policy;
    if (anchor != 'null') {
        policy = 'POLICY[name="'+anchor+'"]';
    } else {
        policy = 'POLICY';
    }

    localStorage["discuri"] = $(xml).find(policy).attr('discuri');
}

function eval_reset() {
    localStorage["trigger_hmi_0"] = 'false';
    localStorage["trigger_hmi_1"] = 'false';
    localStorage["trigger_fpi_0"] = 'false';
    localStorage["trigger_fpi_1"] = 'false';
    localStorage["trigger_pii_0"] = 'false';
    localStorage["trigger_pii_1"] = 'false';
    localStorage["trigger_pii_2"] = 'false';
    localStorage["trigger_pii_3"] = 'false';
    localStorage["trigger_pii_4"] = 'false';
    localStorage["trigger_pii_5"] = 'false';
    localStorage["trigger_nii_0"] = 'false';
    localStorage["trigger_nii_1"] = 'false';
    localStorage["trigger_other"] = 'false';
    localStorage["trigger_count"] = -1;

    localStorage["cat_user_name"]             = 'false';
    localStorage["cat_user_bdate"]            = 'false';
    localStorage["cat_user_cert"]             = 'false';
    localStorage["cat_user_gender"]           = 'false';
    localStorage["cat_user_employer"]         = 'false';
    localStorage["cat_user_department"]       = 'false';
    localStorage["cat_user_jobtitle"]         = 'false';
    localStorage["cat_user_home-info"]        = 'false';
    localStorage["cat_user_business-info"]    = 'false';
    localStorage["cat_user_login"]            = 'false';

    localStorage["cat_third_name"]             = 'false';
    localStorage["cat_third_bdate"]            = 'false';
    localStorage["cat_third_cert"]             = 'false';
    localStorage["cat_third_gender"]           = 'false';
    localStorage["cat_third_employer"]         = 'false';
    localStorage["cat_third_department"]       = 'false';
    localStorage["cat_third_jobtitle"]         = 'false';
    localStorage["cat_third_home-info"]        = 'false';
    localStorage["cat_third_business-info"]    = 'false';
    localStorage["cat_third_login"]            = 'false';

    localStorage["cat_dyn_clickstream"]       = 'false';
    localStorage["cat_dyn_http"]              = 'false';
    localStorage["cat_dyn_clientevents"]      = 'false';
    localStorage["cat_dyn_cookies"]           = 'false';
    localStorage["cat_dyn_searchtext"]        = 'false';
    localStorage["cat_dyn_interactionrecord"] = 'false';

    localStorage["cat_physical"]       = 'false';
    localStorage["cat_online"]         = 'false';
    localStorage["cat_uniqueid"]       = 'false';
    localStorage["cat_purchase"]       = 'false';
    localStorage["cat_financial"]      = 'false';
    localStorage["cat_computer"]       = 'false';
    localStorage["cat_navigation"]     = 'false';
    localStorage["cat_interactive"]    = 'false';
    localStorage["cat_demographic"]    = 'false';
    localStorage["cat_content"]        = 'false';
    localStorage["cat_state"]          = 'false';
    localStorage["cat_political"]      = 'false';
    localStorage["cat_health"]         = 'false';
    localStorage["cat_preference"]     = 'false';
    localStorage["cat_location"]       = 'false';
    localStorage["cat_government"]     = 'false';
    localStorage["cat_other-category"] = 'false';
    localStorage["cat_other-category_str"] = 'null';

    localStorage["purp_current"]             = 'false';
    localStorage["purp_admin"]               = 'false';
    localStorage["purp_develop"]             = 'false';
    localStorage["purp_tailoring"]           = 'false';
    localStorage["purp_pseudo-analysis"]     = 'false';
    localStorage["purp_pseudo-decision"]     = 'false';
    localStorage["purp_individual-analysis"] = 'false';
    localStorage["purp_individual-decision"] = 'false';
    localStorage["purp_contact"]             = 'false';
    localStorage["purp_telemarketing"]       = 'false';
    localStorage["purp_historical"]          = 'false';
    localStorage["purp_other-purpose"]       = 'false';
    localStorage["purp_other-purpose_str"]   = 'null';

    localStorage["rec_ours"]            = 'false';
    localStorage["rec_delivery"]        = 'false';
    localStorage["rec_same"]            = 'false';
    localStorage["rec_other-recipient"] = 'false';
    localStorage["rec_unrelated"]       = 'false';
    localStorage["rec_public"]          = 'false';

    localStorage["ent_name"]                           = 'null';
    localStorage["ent_contact-info.postal.street"]     = 'null';
    localStorage["ent_contact-info.postal.city"]       = 'null';
    localStorage["ent_contact-info.postal.stateprov"]  = 'null';
    localStorage["ent_contact-info.postal.postalcode"] = 'null';
    localStorage["ent_contact-info.postal.country"]    = 'null';
    localStorage["ent_contact-info.online.email"]      = 'null';
    localStorage["ent_contact-info.online.uri"]        = 'null';
    
    localStorage["access_nonident"]          = 'false';
    localStorage["access_all"]               = 'false';
    localStorage["access_contact-and-other"] = 'false';
    localStorage["access_ident-contact"]     = 'false';
    localStorage["access_other-ident"]       = 'false';
    localStorage["access_none"]              = 'false';

    localStorage["disp_type"]  = 'null';
    localStorage["disp_serv"]  = 'null';
    localStorage["disp_short"] = 'null';
    localStorage["disp_long"]  = 'null';

    localStorage["access_count"]  = -1;
    localStorage["contact_count"] = -1;
    localStorage["disp_count"]    = -1;

    localStorage["discuri"] = 'null';
}



function trim(s){
    return s.replace(/^\s*(.*?)\s*$/,"$1")
}

function removeAnchor(input) {
    var hash = input.lastIndexOf('#');
    var output = input;
    if (hash != -1) {
        output = input.substring(0, hash);
    }
    return output;
}

function getAnchor(input) {
    var hash = input.lastIndexOf('#');
    if (hash != -1) {
        return input.substring(hash+1);
    }
    return 'null';
}

function init() {
    canvas = document.getElementById('canvas');
    canvasContext = canvas.getContext('2d');
    gfx = document.getElementById('gfx');

    reloadSettings();
}

function reloadSettings() {

    chrome.browserAction.setBadgeBackgroundColor({ color: [190, 10, 10, 255] });

    if (localStorage["gc_priv_lvl"] == null ||
        localStorage["gc_priv_lvl"] == undefined ||
        localStorage["gc_priv_lvl"] == "") {
        localStorage["gc_priv_lvl"] = "1";
        localStorage["gc_hmi_0"] = true;
        localStorage["gc_hmi_1"] = true;
        localStorage["gc_fpi_0"] = false;
        localStorage["gc_fpi_1"] = true;
        localStorage["gc_pii_0"] = false;
        localStorage["gc_pii_1"] = false;
        localStorage["gc_pii_2"] = true;
        localStorage["gc_pii_3"] = false;
        localStorage["gc_pii_4"] = true;
        localStorage["gc_pii_5"] = true;
        localStorage["gc_nii_0"] = false;
        localStorage["gc_nii_1"] = false;
        localStorage["gc_all_sound_off"]     = false;
        localStorage["gc_match_sound_off"]   = false;
        localStorage["gc_unmatch_sound_off"] = false;
        localStorage["gc_unknown_sound_off"] = true;
    }

    if (localStorage["gc_version"] == null ||
        localStorage["gc_version"] == undefined ||
        localStorage["gc_version"] != "1.0") {
        localStorage["gc_version"] = "1.0";
        chrome.tabs.create({ url: "about.html" });
    }

    stopAnimate();
}



/***** Animation Stuff *****/

var canvas;
var canvasContext;
var gfx;
var rotation = 1;
var animTimer;
var animDelay = 10;

function startAnimate() {
    gfx.src = 'icons/loading_blue_quarter.png';
    stopAnimate();
    animTimer = setInterval("doAnimate()", animDelay);
}

function stopAnimate() {
    if (animTimer != null)
        clearTimeout(animTimer);

    rotation = 1;
}

function doAnimate() {
    canvasContext.save();
    canvasContext.clearRect(
        0,
        0,
        canvas.width, 
        canvas.height);
    canvasContext.translate(
        Math.ceil(canvas.width / 2),
        Math.ceil(canvas.height / 2));
    canvasContext.rotate(rotation * 2 * Math.PI);
    canvasContext.drawImage(
        gfx,
        -Math.ceil(canvas.width / 2),
        -Math.ceil(canvas.height / 2));
    canvasContext.restore();

    rotation += 0.01;
    chrome.browserAction.setIcon({
        imageData: canvasContext.getImageData(
            0, 
            0,
            canvas.width, 
            canvas.height)
    });
}

/***** End Animation Stuff *****/


/***** Icon Subroutines *****/

function playSound(state) {
    if (localStorage["gc_all_sound_off"] == 'true') {
        return;
    }

    if (state == 'match' || state == 'green') {
        if (localStorage["gc_match_sound_off"] != 'true') {
            document.getElementById('match_sound').play();
        }
    } else if (state == 'unmatch' || state == 'red') {
        if (localStorage["gc_unmatch_sound_off"] != 'true') {
            document.getElementById('unmatch_sound').play();
        }
    } else {
        if (localStorage["gc_unknown_sound_off"] != 'true') {
            document.getElementById('unknown_sound').play();
        }
    }
}

function setIcon(color) {
    var iconName;
    var iconPath;
    if (color == 'green') {
        iconName = "greenbird_icon";
    } else if (color == 'red') {
        iconName = "redbird_icon";
    } else if (color == 'gray' || color == 'grey') {
        iconName = "sleepbird_icon";
    } else {
        iconName = "yellowbird_icon";
    }

    iconPath = "icons/" + iconName + ".png";
    chrome.browserAction.setIcon({ path: iconPath });
}

function setMatch(tabId, url) {
    if (localStorage["current_tab_id"] != tabId || 
        localStorage["current_tab_url"] != url) {
        return;
    }
    stopAnimate();
    setIcon('green');
    chrome.browserAction.setPopup({tabId: tabId, popup: 'popup.html'});
    chrome.browserAction.setBadgeText({ text: "" });
    playSound('match');
}

function setUnmatch(tabId, url, count) {
    if (localStorage["current_tab_id"] != tabId || 
        localStorage["current_tab_url"] != url) {
        return;
    }
    stopAnimate();
    setIcon('red');
    chrome.browserAction.setPopup({tabId: tabId, popup: 'popup.html'});
    var countStr = count + "";
    chrome.browserAction.setBadgeText({ text: countStr });
    playSound('unmatch');
}

function setUnknown(tabId, url) {
    if (localStorage["current_tab_id"] != tabId || 
        localStorage["current_tab_url"] != url) {
        return;
    }
    stopAnimate();
    setIcon('yellow');
    chrome.browserAction.setPopup({tabId: tabId, popup: 'popup_yellow.html'});
    chrome.browserAction.setBadgeText({ text: "?" });
    playSound('unknown');
}

function setInvalid(tabId, url) {
    if (localStorage["current_tab_id"] != tabId || 
        localStorage["current_tab_url"] != url) {
        return;
    }
    stopAnimate();
    setIcon('yellow');
    chrome.browserAction.setPopup({tabId: tabId, popup: 'popup_yellow.html'});
    chrome.browserAction.setBadgeText({ text: "X" });
    playSound('unknown');
}

function setDisabled(tabId, url) {
    if (localStorage["current_tab_id"] != tabId ||
        localStorage["current_tab_url"] != url) {
        return;
    }
    stopAnimate();
    setIcon('gray');
    chrome.browserAction.setPopup({tabId: tabId, popup: ''});
    chrome.browserAction.setBadgeText({ text: "" });
}

/***** End Icon Subroutines *****/



