let screenshotButton = document.getElementById("screenshot")
screenshotButton.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "save_page" })
    })
})
