// 拦截全局 fetch 请求以实现抓包
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
    console.log('\n================ [API 请求 Request] ================');
    console.log(`URL: ${input}`);
    console.log(`Method: ${init?.method || 'GET'}`);
    if (init?.body) {
        try {
            // 格式化输出 JSON 请求体
            console.log('Payload:', JSON.stringify(JSON.parse(init.body as string), null, 2));
        } catch {
            console.log('Payload:', init.body);
        }
    }

    const response = await originalFetch(input, init);

    // 克隆 Response，防止解析 body 后导致 SDK 无法读取
    const clonedRes = response.clone();
    console.log('\n================ [API 响应 Response] ================');
    console.log(`Status: ${response.status} ${response.statusText}`);
    try {
        const json = await clonedRes.json();
        console.log('Data:', JSON.stringify(json, null, 2));
    } catch {
        try {
            console.log('Text Data:', await clonedRes.text());
        } catch (err) {
            console.log('无法解析 Response Body');
        }
    }
    console.log('=====================================================\n');

    return response;
};
