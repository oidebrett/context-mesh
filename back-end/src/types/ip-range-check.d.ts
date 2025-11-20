declare module 'ip-range-check' {
    function ipRangeCheck(addr: string, range: string | string[]): boolean;
    export = ipRangeCheck;
}
