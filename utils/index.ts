export const addressAbr = (address: string) => {
    return address.slice(0, 5) + '...' + address.slice(-3)
}
