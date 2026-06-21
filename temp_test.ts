import { addressAbr } from './utils/index';

// 1. 正常缩写
console.log("--- 正常缩写 ---");
console.log(addressAbr("0x1234567890abcdef", 5, 3)); // 期望输出 "0x123...def"
console.log(addressAbr("0xabcdef1234567890", 6, 4)); // 期望输出 "0xabcd...7890"

// 2. 地址过短，返回原地址
console.log("--- 地址过短，返回原地址 ---");
console.log(addressAbr("0x1234567", 5, 3));    // 期望输出 "0x1234567"
console.log(addressAbr("0x12345678", 5, 3));   // 期望输出 "0x12345678"
console.log(addressAbr("0x123456789", 5, 3));  // 期望输出 "0x123456789"

// 3. 空字符串或非字符串输入
console.log("--- 空字符串或非字符串输入 ---");
console.log(addressAbr(""));                 // 期望输出 ""
console.log(addressAbr(null as any));       // 期望输出 ""
console.log(addressAbr(undefined as any));  // 期望输出 ""
console.log(addressAbr(123 as any));        // 期望输出 ""
