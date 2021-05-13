const xhr = new XMLHttpRequest();
xhr.open("get", "lwr.xml");
xhr.overrideMimeType("application/xml");
xhr.onload = main;
xhr.send();

function main() {
    const el = document.getElementById("main");
    const doc = xhr.responseXML;

    ;

    /** @param {string} volumeId */
    async function run(volumeId) {
        const volume = doc.getElementById(volumeId);
        
    }
}