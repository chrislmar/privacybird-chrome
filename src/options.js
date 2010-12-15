/* Extensions to the local storage class for object storage */
Storage.prototype.setObject = function (key, value) {
    this.setItem(key, JSON.stringify(value));
}

Storage.prototype.getObject = function (key) {
    return this.getItem(key) && JSON.parse(this.getItem(key));
}

function sortlist(lb) {
    var arrTexts = new Array();
    for (i = 0; i < lb.length; i++) {
        arrTexts[i] = lb.options[i].text + ':' + lb.options[i].value + ':' + lb.options[i].selected;
    }
    arrTexts.sort(charOrdA);
    for (i = 0; i < lb.length; i++) {
        var el = arrTexts[i].split(':');
        lb.options[i].text = el[0];
        lb.options[i].value = el[1];
        lb.options[i].selected = (el[2] == "true") ? true : false;
    }
}

function charOrdA(a, b) {
    a = a.toLowerCase();
    b = b.toLowerCase();
    if (a > b) return 1;
    if (a < b) return -1;
    return 0;
}

// Saves options to localStorage.
var boolIdArray = new Array("hmi_0", "hmi_1", "fpi_0", "fpi_1", "pii_0", "pii_1", "pii_2", "pii_3", "pii_4", "pii_5", "nii_0", "nii_1", "all_sound_off", "match_sound_off", "unmatch_sound_off", "unknown_sound_off");
var accounts;

function save_options() {
    for (var i in boolIdArray) {
        var id = boolIdArray[i];
        var element = document.getElementById(id);
        var value = element.checked;
        localStorage["gc_" + id] = value;

        console.log("saved: " + id + " as " + value);
    }

    var previewRadios = document.forms[0].priv_lvl;
    for (var i in previewRadios) {
        if (previewRadios[i].checked) {
            localStorage["gc_priv_lvl"] = previewRadios[i].value;
            console.log("saved: priv_lvl as " + previewRadios[i].value);
            break;
        }
    }
    

    var backgroundPage = chrome.extension.getBackgroundPage();
    backgroundPage.init();
}

// Restores input states to saved values from localStorage.
function restore_options() {

    for (var i in boolIdArray) {
        var id = boolIdArray[i];
        var value = localStorage["gc_" + id];

        if (value == "true") {
            var element = document.getElementById(id);
            element.checked = true;
        }

        console.log("restored: " + id + " as " + value);
    }

    var previewRadios = document.forms[0].priv_lvl;
    for (var i in previewRadios) {
        if (previewRadios[i].value == localStorage["gc_priv_lvl"]) {
            previewRadios[i].checked = true;
            console.log("restored: priv_lvl as " + previewRadios[i].value);
            break;
        }
    }
}

// Privacy Level Settings

function priv_lvl_low() {
    document.options.hmi_0.checked = true;
    document.options.hmi_1.checked = true;
    document.options.fpi_0.checked = false;
    document.options.fpi_1.checked = false;
    document.options.pii_0.checked = false;
    document.options.pii_1.checked = false;
    document.options.pii_2.checked = true;
    document.options.pii_3.checked = false;
    document.options.pii_4.checked = false;
    document.options.pii_5.checked = false;
    document.options.nii_0.checked = false;
    document.options.nii_1.checked = false;
}

function priv_lvl_med() {
    document.options.hmi_0.checked = true;
    document.options.hmi_1.checked = true;
    document.options.fpi_0.checked = false;
    document.options.fpi_1.checked = true;
    document.options.pii_0.checked = false;
    document.options.pii_1.checked = false;
    document.options.pii_2.checked = true;
    document.options.pii_3.checked = false;
    document.options.pii_4.checked = true;
    document.options.pii_5.checked = true;
    document.options.nii_0.checked = false;
    document.options.nii_1.checked = false;
}

function priv_lvl_high() {
    document.options.hmi_0.checked = true;
    document.options.hmi_1.checked = true;
    document.options.fpi_0.checked = true;
    document.options.fpi_1.checked = true;
    document.options.pii_0.checked = true;
    document.options.pii_1.checked = true;
    document.options.pii_2.checked = true;
    document.options.pii_3.checked = true;
    document.options.pii_4.checked = true;
    document.options.pii_5.checked = true;
    document.options.nii_0.checked = true;
    document.options.nii_1.checked = true;
}

function priv_lvl_cust() {
    var len = document.options.priv_lvl.length;
    for (var i = 0; i < len; i++) {
        document.options.priv_lvl[i].checked = false;
        if (document.options.priv_lvl[i].value == "3") {
            document.options.priv_lvl[i].checked = true;
        }
    }
}

function disable_all_sound() {
    /*
    if (document.options.all_sound_off.checked == true) {
        document.options.match_sound_off.checked   = true;
        document.options.unmatch_sound_off.checked = true;
        document.options.unknown_sound_off.checked = true;
    }
    */
    document.options.match_sound_off.checked   = document.options.all_sound_off.checked;
    document.options.unmatch_sound_off.checked = document.options.all_sound_off.checked;
    document.options.unknown_sound_off.checked = document.options.all_sound_off.checked;
}

function disable_one_sound() {
    document.options.all_sound_off.checked = false;
}

