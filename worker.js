addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  try {
      const url = new URL(request.url);

      // 如果访问根目录，返回HTML
      if (url.pathname === "/") {
          return new Response(getRootHtml(), {
              headers: {
                  'Content-Type': 'text/html; charset=utf-8'
              }
          });
      }

      // 从请求路径中提取目标 URL
      let actualUrlStr = decodeURIComponent(url.pathname.replace("/", ""));

      // 判断用户输入的 URL 是否带有协议
      actualUrlStr = ensureProtocol(actualUrlStr, url.protocol);

      // 保留查询参数
      actualUrlStr += url.search;

      // 创建新 Headers 对象，排除以 'cf-' 开头的请求头
      const newHeaders = filterHeaders(request.headers, name => !name.startsWith('cf-'));

      // 创建一个新的请求以访问目标 URL
      const modifiedRequest = new Request(actualUrlStr, {
          headers: newHeaders,
          method: request.method,
          body: request.body,
          redirect: 'manual'
      });

      // 发起对目标 URL 的请求
      const response = await fetch(modifiedRequest);
      let body = response.body;

      // 处理重定向
      if ([301, 302, 303, 307, 308].includes(response.status)) {
          body = response.body;
          // 创建新的 Response 对象以修改 Location 头部
          return handleRedirect(response, body);
      } else if (response.headers.get("Content-Type")?.includes("text/html")) {
          body = await handleHtmlContent(response, url.protocol, url.host, actualUrlStr);
      }

      // 创建修改后的响应对象
      const modifiedResponse = new Response(body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
      });

      // 添加禁用缓存的头部
      setNoCacheHeaders(modifiedResponse.headers);

      // 添加 CORS 头部，允许跨域访问
      setCorsHeaders(modifiedResponse.headers);

      return modifiedResponse;
  } catch (error) {
      // 如果请求目标地址时出现错误，返回带有错误消息的响应和状态码 500（服务器错误）
      return jsonResponse({
          error: error.message
      }, 500);
  }
}

// 确保 URL 带有协议
function ensureProtocol(url, defaultProtocol) {
  return url.startsWith("http://") || url.startsWith("https://") ? url : defaultProtocol + "//" + url;
}

// 处理重定向
function handleRedirect(response, body) {
  const location = new URL(response.headers.get('location'));
  const modifiedLocation = `/${encodeURIComponent(location.toString())}`;
  return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
          ...response.headers,
          'Location': modifiedLocation
      }
  });
}

// 处理 HTML 内容中的相对路径
async function handleHtmlContent(response, protocol, host, actualUrlStr) {
  const originalText = await response.text();
  const regex = new RegExp('((href|src|action)=["\'])/(?!/)', 'g');
  let modifiedText = replaceRelativePaths(originalText, protocol, host, new URL(actualUrlStr).origin);

  return modifiedText;
}

// 替换 HTML 内容中的相对路径
function replaceRelativePaths(text, protocol, host, origin) {
  const regex = new RegExp('((href|src|action)=["\'])/(?!/)', 'g');
  return text.replace(regex, `$1${protocol}//${host}/${origin}/`);
}

// 返回 JSON 格式的响应
function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
      status: status,
      headers: {
          'Content-Type': 'application/json; charset=utf-8'
      }
  });
}

// 过滤请求头
function filterHeaders(headers, filterFunc) {
  return new Headers([...headers].filter(([name]) => filterFunc(name)));
}

// 设置禁用缓存的头部
function setNoCacheHeaders(headers) {
  headers.set('Cache-Control', 'no-store');
}

// 设置 CORS 头部
function setCorsHeaders(headers) {
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  headers.set('Access-Control-Allow-Headers', '*');
}

// 返回根目录的 HTML
function getRootHtml() {
  return `<!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <title>GlobalProxy 免责声明</title>
    <meta name="description" content="GlobalProxy 免责声明">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body {
        margin: 0;
        padding: 20px;
        font-family: Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        background-color: #f9f9f9;
      }
      h1 {
        text-align: center;
        margin-bottom: 20px;
      }
      .container {
        max-width: 800px;
        margin: 0 auto;
        background: #fff;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }
      p {
        margin-bottom: 15px;
        text-align: justify;
      }
      .disclaimer-title {
        font-weight: bold;
        margin-top: 20px;
      }
      .highlight {
        color: #e74c3c; /* 红色 */
        font-weight: bold;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>免责声明</h1>

      <p>请使用以下格式访问 API：<span class="highlight">https://url.yh-iot.cloudns.org/目标地址</span>。 其中，目标地址 是您想要访问的网址，请确保目标地址是有效的 URL 格式<p>


      <p>本服务仅面向非大陆地区用户，大陆地区用户在使用本服务时需自行承担因法律法规限制可能带来的风险。</p>
      <p>GlobalProxy 作为服务提供者并不对其服务中包含的任何内容的准确性、完整性或合法性做出保证。用户应对服务中的信息进行验证和判断。</p>
      <p>GlobalProxy 的服务可能受到外部因素的影响，包括但不限于网络故障、服务器故障等。服务提供者不对由这些因素导致的服务中断或故障负责。</p>
      <p>使用 GlobalProxy 代理服务涉及用户与第三方网站的交互，用户应自行承担与这些网站交互所带来的一切风险。</p>
      <p>GlobalProxy 代理服务不提供任何明示或暗示的担保，包括但不限于服务的适用性、准确性、可靠性、完整性。</p>
      <p>用户在使用 GlobalProxy 代理服务时应遵守所有适用的法律和法规，包括但不限于知识产权、隐私权、信息安全等方面的法规。</p>
      <p>服务提供者不对用户使用 GlobalProxy 代理服务可能引发的任何法律责任负责，包括但不限于因侵犯第三方权益而导致的法律纠纷。</p>
      <p>GlobalProxy 代理服务可能会记录用户的部分信息，用于改善服务质量和确保服务安全。然而，服务提供者将尽最大努力保护用户的隐私。</p>
      <p>服务提供者保留在没有提前通知的情况下随时修改、暂停或终止 GlobalProxy 服务的权利。</p>
      <p>GlobalProxy 代理服务可能会访问和处理用户的请求，但不保证对所有请求均能提供成功的响应。</p>
      <p class="disclaimer-title">本免责声明的任何更改将通过本页面发布，用户应定期查看以获取最新信息。</p>
      <p>本免责声明的效力范围将覆盖代理服务的所有用户，包括但不限于匿名用户。</p>
      <p>代理服务可能包含第三方提供的服务或链接，服务提供者对这些服务或链接不承担责任。</p>
      <p>在适用法律允许的范围内，服务提供者对代理服务的所有方面不提供任何明示或暗示的担保。</p>
      <p>对于因不可抗力、自然灾害等不可控因素导致的服务中断或故障，服务提供者不承担责任。</p>
      <p>代理服务可能受到技术限制，可能无法支持所有类型的请求和内容。</p>
      <p>用户在使用代理服务时，应保持合理谨慎，自行承担风险，对于因使用代理服务而导致的一切后果负责。</p>
      <p>如果您对本免责声明有任何疑问，请邮件联系。将尽全力为您提供必要的协助和解释。</p>
      <p class="disclaimer-title">在使用本服务前务必审慎阅读并理解本免责声明的全部内容，使用本服务将被视为对本免责声明的接受和遵守。</p>
    </div>
  </body>
  </html>`;
}
