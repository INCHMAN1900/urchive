registerTwitter()
registerChrome()

function registerTwitter() {
    let timeline = document.getElementsByTagName("main")[0]
    if (!timeline) return

    timeline.addEventListener("click", function (event) {
        // 检查是否点击了点赞按钮
        const likeButton = event.target.closest('[aria-label~="Like"]')
        if (!likeButton) {
            return
        }
        // 找到包含的推文
        const tweet = likeButton.closest("article")
        if (!tweet) {
            return
        }
        // 查找推文中的图片

        console.log(tweet, tweet.getBoundingClientRect())
        let boundingClientRect = tweet.getBoundingClientRect()
        chrome.runtime.sendMessage({
            action: "takeScreenshot",
            boundingClientRect: boundingClientRect,
        })

        const images = tweet.querySelectorAll('img[src*="twimg.com/media"]')

        // if (imageElement) {
        // 	// 如果有图片，则发送下载图片的请求
        // 	const imageUrl = imageElement.src;
        // 	chrome.runtime.sendMessage({ action: 'downloadImage', imageUrl: imageUrl });
        // }
    })
}

function registerChrome() {
    // let main = document.getElementById('main');
    // if (!main) return;
    // main.addEventListener('click', () => {
    // 	console.log("click")
    // 	chrome.runtime.sendMessage({ action: 'takeScreenshot' });
    // })
}

function convertRelativeLinksToAbsolute(doc) {
    const anchorElements = doc.querySelectorAll("a")

    anchorElements.forEach((anchor) => {
        const href = anchor.getAttribute("href")
        if (href && !href.startsWith("http") && !href.startsWith("#")) {
            const absoluteUrl = new URL(href, window.location.href).href
            anchor.setAttribute("href", absoluteUrl)
        }
    })
}

// 用于递归处理 @import 的函数
function processCSSImports(cssText, baseUrl) {
    const importRegex = /@import\s+url\(["']?(.*?)["']?\);/g
    const importMatches = [...cssText.matchAll(importRegex)]

    const importPromises = importMatches.map((match) => {
        const importUrl = new URL(match[1], baseUrl).href // 处理相对路径
        return fetch(importUrl)
            .then((response) => response.text())
            .then((importedCssText) => {
                // 递归处理嵌套的 @import
                return processCSSImports(importedCssText, importUrl).then(
                    (finalCss) => {
                        cssText = cssText.replace(match[0], finalCss) // 用导入的 CSS 替换 @import 语句
                        return cssText
                    },
                )
            })
            .catch((error) => {
                console.error("Failed to load imported CSS:", error)
                return cssText // 失败时保留原始的 @import 语句
            })
    })

    return Promise.all(importPromises).then(() => cssText)
}

/**
 * 处理 <img> 和 <source> 标签的 Base64 转换
 * @param {HTMLImageElement} element
 * @returns {Promise}
 */
function convertImageAndSourceToBase64(element) {
    return fetch(element.src)
        .then((response) => response.blob())
        .then(
            (blob) =>
                new Promise((resolve, reject) => {
                    const reader = new FileReader()
                    reader.onloadend = () => {
                        element.src = reader.result // 将 <img> 的 src 转为 base64
                        resolve()
                    }
                    reader.onerror = reject
                    reader.readAsDataURL(blob)
                }),
        )
        .catch((error) => {
            console.error("Failed to load image src:", error)
            return element.src // 失败时保留原始的 @import 语句
        })
}

// 处理 <source> 的 srcset 属性
function convertSourceSrcsetToBase64(source) {
    const srcset = source.getAttribute("srcset")
    if (!srcset) return Promise.resolve()

    // 处理 srcset 中多个逗号分隔的 URL
    const srcsetItems = srcset.split(",").map((item) => {
        const [url, descriptor] = item.trim().split(" ") // 提取 URL 和描述符
        return fetch(url)
            .then((response) => response.blob())
            .then(
                (blob) =>
                    new Promise((resolve, reject) => {
                        const reader = new FileReader()
                        reader.onloadend = () => {
                            resolve(`${reader.result} ${descriptor}`) // 将 URL 转为 base64 并保留描述符
                        }
                        reader.onerror = reject
                        reader.readAsDataURL(blob)
                    }),
            )
            .catch((error) => {
                console.error("Failed to load srcset items:", error)
                return `${url} ${descriptor}` // 失败时保留原始的 @import 语句
            })
    })

    return Promise.all(srcsetItems).then((results) => {
        source.setAttribute("srcset", results.join(", ")) // 更新 srcset 属性
    })
}

function savePage() {
    const doc = document.documentElement.cloneNode(true)

    // 转换所有相对路径的 <a> 标签为绝对路径
    convertRelativeLinksToAbsolute(doc)

    // 抓取外部样式表并将其内联
    const linkElements = doc.querySelectorAll('link[rel="stylesheet"]')
    const stylePromises = Array.from(linkElements).map((link) => {
        const cssUrl = link.href

        return fetch(cssUrl)
            .then((response) => response.text())
            .then((cssText) => {
                // 处理 @import 语句
                return processCSSImports(cssText, cssUrl)
            })
            .then((finalCssText) => {
                // 创建新的 <style> 标签并插入到文档头部
                const styleElement = document.createElement("style")
                styleElement.textContent = finalCssText
                link.replaceWith(styleElement)
            })
            .catch((error) => {
                console.error("Failed to load CSS:", error)
            })
    })

    // 处理图片，转换为 Base64
    const imageElements = doc.querySelectorAll("img")
    const sourceElements = doc.querySelectorAll("source")

    const imagePromises = Array.from(imageElements).map(
        convertImageAndSourceToBase64,
    )
    const sourcePromises = Array.from(sourceElements).map(
        convertSourceSrcsetToBase64,
    )

    // 等待所有外部样式、@import 样式和图片处理完成
    Promise.all([...stylePromises, ...imagePromises, ...sourcePromises]).then(
        () => {
            // 获取页面的 HTML 内容
            const htmlContent = `<!DOCTYPE html>\n${doc.outerHTML}`

            console.log(htmlContent)

            // 发送数据给 background.js 进行下载
            chrome.runtime.sendMessage({
                action: "downloadPage",
                content: htmlContent,
            })
        },
    )
}

// 监听 popup.js 发来的保存请求
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "save_page") {
        savePage()
    }
})
