chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "takeScreenshot") {
        console.log("take screenshot")
        chrome.tabs
            .captureVisibleTab()
            .then(async (dataUrl) => {
                const boundingClientRect = request.boundingClientRect
                let finalImage = dataUrl
                if (boundingClientRect) {
                    finalImage = await cropImage(
                        dataUrl,
                        boundingClientRect.left,
                        boundingClientRect.top,
                        boundingClientRect.width,
                        boundingClientRect.height,
                    )
                    console.log(finalImage)
                }

                chrome.downloads.download({
                    url: finalImage,
                    filename: `screenshot_${Date.now()}.png`,
                })
            })
            .catch((error) => {
                console.log(error)
            })
    } else if (request.action === "downloadImage") {
        chrome.downloads.download({
            url: request.imageUrl,
            filename: `image_${Date.now()}.jpg`,
        })
    }

    if (request.action === "downloadPage") {
        const url = createBase64DataUrl(request.content, "text/html")

        chrome.downloads.download({
            url: url,
            filename: "offline_page.html",
        })

        sendResponse({ status: "download_started" })
    }
})

// 将字符串转换为 Base64 格式
function stringToBase64(content) {
    // 将字符串转换为 UTF-8 编码的 Uint8Array
    const utf8Encoder = new TextEncoder()
    const uint8Array = utf8Encoder.encode(content)

    // 将 Uint8Array 转换为字符串
    let binaryString = ""
    uint8Array.forEach((byte) => {
        binaryString += String.fromCharCode(byte)
    })

    // 使用 btoa() 将二进制字符串转换为 Base64 编码
    return btoa(binaryString)
}

// 生成 Base64 数据 URL
function createBase64DataUrl(content, mimeType = "text/plain") {
    const base64Content = stringToBase64(content)
    // 返回 Base64 数据 URL
    return `data:${mimeType};base64,${base64Content}`
}

function cropImage(imageDataUrl, startX, startY, width, height) {
    // 创建一个离屏画布，尺寸为目标截取区域的宽高
    const canvas = new OffscreenCanvas(width, height)
    canvas.width = width * 2
    canvas.height = height * 2
    const ctx = canvas.getContext("2d")

    const blob = base64ToBlob(imageDataUrl, "image/png")

    return createImageBitmap(blob)
        .then((imageBitRep) => {
            ctx.drawImage(
                imageBitRep,
                startX * 2,
                startY * 2,
                width * 2,
                height * 2,
                0,
                0,
                width * 2,
                height * 2,
            )
            return canvas.convertToBlob({ type: "image/png" })
        })
        .then((imageBlob) => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = (e) => {
                    resolve(reader.result)
                }
                reader.onerror = () => {
                    reject()
                }
                reader.readAsDataURL(imageBlob)
            })
        })
}

function base64ToBlob(base64, mimeType) {
    const base64String = base64.replace(/data:image\/(jpeg|png);base64,/, "")
    const byteCharacters = atob(base64String)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    return new Blob([byteArray], { type: mimeType })
}
