/**
 * Caching Algorithm/Implementation
 * 
 * Store URL of XML policy
 *   - sorted list
 *   - oldest element at front, newest at back
 *
 *
 * Eviction policy
 *   - Least Recently Used (LRU)
 *   - remove from front - shift()
 *   - add to end        - push()
 */
var max_xml_cache = 30;
var max_url_cache = 30;
var max_dne_cache = 50;

// add new url to valid cache (handles eviction)
function cache_valid_add(p3pUrl) {
    if (localStorage["cache_valid"] == undefined ||
        localStorage["cache_valid"] == null) {
        var cache = new Array();
        cache.push(p3pUrl);
        localStorage["cache_valid"] = cache.join(";");
    } else {
        // search for presence in cache
        var cache = localStorage["cache_valid"].split(";");
        var idx = -1;
        for (i = 0; i < cache.length; i++) {
            if (cache[i] == p3pUrl) {
                idx = i;
                break;
            }
        }
        // idx equals -1 or index of element
        if (idx == -1) {
            // element doesn't exist
            // if cache is maxed out, evict and add new element
            if (cache.length >= max_xml_cache) {
                cache.shift();
                cache.push(p3pUrl);
                localStorage["cache_valid"] = cache.join(";");
            } else {
                cache.push(p3pUrl);
                localStorage["cache_valid"] = cache.join(";");
            }
        } else {
            // element DOES exist, so remove and add to end
            var found = cache[idx];

            // remove found, shift left, add found to end
            cache.splice(idx, 1);
            cache.push(found);
            localStorage["cache_valid"] = cache.join(";");
        }
    }
}

function cache_invalid_add(p3pUrl) {
    if (localStorage["cache_invalid"] == undefined ||
        localStorage["cache_invalid"] == null) {
        var cache = new Array();
        cache.push(p3pUrl);
        localStorage["cache_invalid"] = cache.join(";");
    } else {
        // search for presence in cache
        var cache = localStorage["cache_invalid"].split(";");
        var idx = -1;
        for (i = 0; i < cache.length; i++) {
            if (cache[i] == p3pUrl) {
                idx = i;
                break;
            }
        }
        // idx equals -1 or index of element
        if (idx == -1) {
            // element doesn't exist
            // if cache is maxed out, evict and add new element
            if (cache.length >= max_xml_cache) {
                cache.shift();
                cache.push(p3pUrl);
                localStorage["cache_invalid"] = cache.join(";");
            } else {
                cache.push(p3pUrl);
                localStorage["cache_invalid"] = cache.join(";");
            }
        } else {
            // element DOES exist, so remove and add to end
            var found = cache[idx];
    
            // remove found, shift left, add found to end
            cache.splice(idx, 1);
            cache.push(found);
            localStorage["cache_invalid"] = cache.join(";");
        }
    }
}

// returns -1 if not in cache
// returns 0 if present in valid cache
// returns 1 if present in invalid cache
function cache_xml_lookup(p3pUrl) {
    if (localStorage["cache_valid"] != undefined &&
        localStorage["cache_valid"] != null) {
        var cache = localStorage["cache_valid"].split(";");
        for (i = 0; i < cache.length; i++) {
            if (cache[i] == p3pUrl) {
                return 0;
            }
        }
    }
    if (localStorage["cache_invalid"] != undefined &&
        localStorage["cache_invalid"] != null) {
        var cache = localStorage["cache_invalid"].split(";");
        for (i = 0; i < cache.length; i++) {
            if (cache[i] == p3pUrl) {
                return 1;
            }
        }
    }
    return -1;
}

function url_obj(url, p3pUrl) {
    this.url = url;
    this.xml = p3pUrl;
}

function cache_url_add(url, p3pUrl) {
    if (localStorage["cache_url"] == undefined ||
        localStorage["cache_url"] == null) {
        var cache = new Array();
        var obj = new url_obj(url, p3pUrl);
        cache.push(JSON.stringify(obj));
        localStorage["cache_url"] = cache.join(";");
    } else {
        var cache = localStorage["cache_url"].split(";");
        var idx = -1;
        for (i = 0; i < cache.length; i++) {
            var obj = JSON.parse(cache[i]);
            if (obj.url == url && obj.xml == p3pUrl) {
                idx = i;
                break;
            }
        }
        if (idx == -1) { // element doesn't exist
            if (cache.length >= max_url_cache) {
                cache.shift();
                var new_obj = new url_obj(url, p3pUrl);
                cache.push(JSON.stringify(new_obj));
                localStorage["cache_url"] = cache.join(";");
            } else {
                var new_obj = new url_obj(url, p3pUrl);
                cache.push(JSON.stringify(new_obj));
                localStorage["cache_url"] = cache.join(";");
            }
        } else {
            var found = cache[idx];
            cache.splice(idx, 1);
            cache.push(found);
            localStorage["cache_url"] = cache.join(";");
        }
    }
}

// returns 'null' if not in cache
// returns xml url if present in url cache
function cache_url_lookup(url) {
    if (localStorage["cache_url"] != undefined &&
        localStorage["cache_url"] != null) {
        var cache = localStorage["cache_url"].split(";");
        for (i = 0; i < cache.length; i++) {
            var obj = JSON.parse(cache[i]);
            if (obj.url == url) {
                return obj.xml;
            }
        }
    }
    return 'null';
}

function cache_dne_add(url) {
    if (localStorage["cache_dne"] == undefined ||
        localStorage["cache_dne"] == null) {
        var cache = new Array();
        cache.push(url);
        localStorage["cache_dne"] = cache.join(";");
    } else {
        var cache = localStorage["cache_dne"].split(";");
        var idx = -1;
        for (i = 0; i < cache.length; i++) {
            if (cache[i] == url) {
                idx = i;
                break;
            }
        }
        if (idx == -1) { // element doesn't exist
            if (cache.length >= max_dne_cache) {
                cache.shift();
                cache.push(url);
                localStorage["cache_dne"] = cache.join(";");
            } else {
                cache.push(url);
                localStorage["cache_dne"] = cache.join(";");
            }
        } else {
            var found = cache[idx];
            cache.splice(idx, 1);
            cache.push(found);
            localStorage["cache_dne"] = cache.join(";");
        }
    }
}

// returns -1 if not in cache
// returns 0 if present in url cache
function cache_dne_lookup(url) {
    if (localStorage["cache_dne"] != undefined &&
        localStorage["cache_dne"] != null) {
        var cache = localStorage["cache_dne"].split(";");
        for (i = 0; i < cache.length; i++) {
            if (cache[i] == url) {
                return 0;
            }
        }
    }
    return -1;
}

/***** End Cache *****/

