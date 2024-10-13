// 用于保存当前高亮的元素
let highlightedElement = null

// document.addEventListener("click", captureElementScreenshot)
// document.addEventListener("mousemove", highlightElement)

// 高亮鼠标悬停的元素
function highlightElement(event) {
    if (highlightedElement) {
        highlightedElement.style.outline = "" // 清除上一个元素的高亮
    }

    const element = event.target

    // 忽略 body 元素，避免整个页面被高亮
    if (element !== document.body) {
        element.style.outline = "2px solid red" // 给当前元素添加红色边框
        highlightedElement = element
    }
}

// 捕捉选中元素的截图
function captureElementScreenshot(event) {
    html2canvas(event.target).then((canvas) => {
        chrome.runtime.sendMessage({
            action: "downloadImage",
            imageUrl: canvas.toDataURL("image/png"),
        })
    })
}
