export const addressAbr = (
  address: string,
  prefixLength: number = 5,
  suffixLength: number = 3
) => {
  // 1. 增加输入校验
  if (typeof address !== "string" || address === "") {
    return "";
  }

  // 3. 处理地址过短的情况
  if (address.length <= prefixLength + suffixLength + 3) {
    return address;
  }

  return (
    address.slice(0, prefixLength) + "..." + address.slice(-suffixLength)
  );
};

export const isType = (val: string | object | number | any[]) => {
  return (type: string) => {
    return Object.prototype.toString.call(val) === `[object ${type}]`;
  };
};

export const formateUrl = (params: string) => {
  if (isType(params)('String')) {
    if (/^http(s)?/.test(params)) {
      const url = new URL(params);
      // 将参数转换成http://localhost:8080?a=1&b=2   -> {a:1,b:2}
      return Object.fromEntries(url.searchParams.entries());
    }
    // params如果为a=1&b=2,则转换成{a:1,b=2}
    return Object.fromEntries(new URLSearchParams(params).entries());
  }
};