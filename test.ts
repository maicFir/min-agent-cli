/**
 * 计算两个数字的和
 * @param a 第一个加数
 * @param b 第二个加数
 * @returns 两个数字之和
 */
export function add(a: number, b: number): number {
    return a + b;
}

/**
 * 冒泡排序算法（不改变原数组）
 * @param arr 待排序的数字数组
 * @returns 排序后的新数组
 */
export function bubbleSort(arr: number[]): number[] {
    // 浅拷贝一份数组，遵循纯函数原则，避免副作用
    const sortedArray = [...arr];
    const len = sortedArray.length;

    for (let i = 0; i < len - 1; i++) {
        // 标记这一轮是否发生过交换，若无交换说明已排好序，可提前结束
        let swapped = false;
        for (let j = 0; j < len - 1 - i; j++) {
            // 使用非空断言 `!` 确保在 strict/noUncheckedIndexedAccess 模式下不会报 "Object is possibly 'undefined'" 错误
            // 因为循环条件限制了 j + 1 < len，索引绝对安全，不会越界
            const current = sortedArray[j]!;
            const next = sortedArray[j + 1]!;

            if (current > next) {
                // 执行值交换
                sortedArray[j] = next;
                sortedArray[j + 1] = current;
                swapped = true;
            }
        }
        // 如果没有发生交换，说明数组已经有序
        if (!swapped) {
            break;
        }
    }

    return sortedArray;
}

// === 测试示例 ===

// 1. 加法测试
const sumResult = add(1, 2);
console.log(`add(1, 2) => ${sumResult}`);

console.log('-----------------------------');

// 2. 冒泡排序测试
const rawArray = [64, 34, 25, 12, 22, 11, 90];
console.log('原数组:', rawArray);

const sorted = bubbleSort(rawArray);
console.log('排序后:', sorted);
console.log('原数组未受影响:', rawArray); // 验证纯函数特性
