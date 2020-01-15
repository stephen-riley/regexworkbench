
import PCRE from '@stephen-riley/pcre2-wasm';
import * as crypto from 'crypto';


export function match(subject: string, pattern: string, switches: string): any[] {
    let re: any;

    try {
        re = new PCRE(pattern, switches);
        const results: any = re.match(subject);
        return [results];
    } catch (e) {
        throw e;
    } finally {
        if (re) {
            re.destroy();
        }
    }
}

export function matchAll(subject: string, pattern: string, switches: string): any[] {
    let re: any;

    try {
        re = new PCRE(pattern, switches);
        const results: any = re.matchAll(subject);
        return results;
    } catch (e) {
        throw e;
    } finally {
        if (re) {
            re.destroy();
        }
    }
}

export function split(subject: string, pattern: string, switches: string): any[] {
    let re: any;
    const id = generateRandomId();

    try {
        re = new PCRE(pattern, switches);
        const result: string = re.substituteAll(subject, id);
        return result.split(id);
    } catch (e) {
        throw e;
    } finally {
        if (re) {
            re.destroy();
        }
    }
}

export function replace(subject: string, pattern: string, switches: string, replacement: string): any {
    let re: any;

    try {
        const matches = match(subject, pattern, switches);
        re = new PCRE(pattern, switches);
        const result: string = re.substitute(subject, replacement);
        return { result, matches: matches };
    } catch (e) {
        throw e;
    } finally {
        if (re) {
            re.destroy();
        }
    }
}

export function replaceAll(subject: string, pattern: string, switches: string, replacement: string): any {
    let re: any;

    try {
        const matches = matchAll(subject, pattern, switches);
        re = new PCRE(pattern, switches);
        const result: string = re.substituteAll(subject, replacement);
        return { result, matches: matches };
    } catch (e) {
        throw e;
    } finally {
        if (re) {
            re.destroy();
        }
    }
}

function generateRandomId() {
    return `--${crypto.randomBytes(16).toString("hex")}--`;
}