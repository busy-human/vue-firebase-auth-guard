import { User as FirebaseUser, ParsedToken as CustomClaimsToken } from "firebase/auth";

interface MatcherPattern {
    email?: string | RegExp;
    phoneNumber?: string | RegExp;
    uid?: string | RegExp;
    tenantId?: string | RegExp;
    claims?: {
        [key: string]: RegExp | string | boolean;
    }
}

interface UserModelResolverOptions<TypeMap extends UserModelMap> {
    defaultModel?: keyof TypeMap;
}

type MatcherOption = MatcherPattern | ((user: FirebaseUser, claims: CustomClaimsToken) => boolean);

export interface UserModelDefinition<T> {
    matcher: MatcherOption;
    builder: (user: FirebaseUser, claims: CustomClaimsToken) => Promise<T>;
}

export interface UserModelMap {
    [key: string]: UserModelDefinition<any>;
}


export class UserModelResolver<TypeMap extends UserModelMap> {
    map: TypeMap;
    defaultModel?: keyof TypeMap;

    constructor(map: TypeMap, options?: UserModelResolverOptions<TypeMap>) {
        this.map = map;
        this.defaultModel = options?.defaultModel;
    }

    testPatternFields(user: FirebaseUser, pattern: MatcherPattern, field: keyof MatcherPattern): boolean {
        if(field === "claims")  {
            throw new Error("Claims cannot be checked with this test method.");
        }
        if(!(field in pattern) || ! pattern[field]) {
            return true;
        }
        if(!(field in user || user[field as keyof FirebaseUser] === undefined)) {
            return false;
        }
        const userFieldValue = (user as any)[field as keyof FirebaseUser];
        if(typeof pattern[field] === "string") {
            return userFieldValue.includes(pattern[field]);
        } else {
            return pattern[field].test(userFieldValue);
        }
    }
    testClaimFields(claims: CustomClaimsToken, pattern: MatcherPattern, field: keyof CustomClaimsToken): boolean {
        if(!("claims" in pattern) ||! pattern.claims) {
            throw new Error("Claims must be present in the pattern to check claims.");
        }
        if(!(field in pattern.claims) || ! pattern.claims[field]) {
            return true;
        }
        if(!(field in claims || claims[field] === undefined)) {
            return false;
        }
        const claimsFieldValue = claims[field];
        if(claimsFieldValue === undefined) {
            return false;
        }
        if(typeof pattern.claims[field] === "boolean") {
            return claimsFieldValue === pattern.claims[field];

        } else if(typeof pattern.claims[field] === "string") {
            return (claimsFieldValue as string).includes(pattern.claims[field]);

        } else {
            return pattern.claims[field].test(claimsFieldValue as string);
        }
    }

    matchWithPattern(user: FirebaseUser, claims: CustomClaimsToken, pattern: MatcherPattern): boolean {
        let match = true;
        let fields: Array<keyof MatcherPattern> = ["email", "phoneNumber", "uid", "tenantId"];
        for(let f in fields) {
            match = this.testPatternFields(user, pattern, f as keyof MatcherPattern);
            if(!match) {
                return false;
            }
        }
        if("claims" in pattern) {
            for(let f in pattern.claims) {
                match = this.testClaimFields(claims, pattern, f as keyof CustomClaimsToken);
                if(!match) {
                    return false;
                }
            }
        }
        return match;
    }

    checkTypeWithMatcher(user: FirebaseUser, claims: CustomClaimsToken, matcher: MatcherOption): boolean {
        if(typeof matcher === "function" && matcher(user, claims) === true) {
            return true;
        } else if(typeof matcher === "object" && this.matchWithPattern(user, claims, matcher)) {
            return true;
        } else if(matcher && (typeof matcher === "function" || typeof matcher === "object")) {
            return false;
        } else {
            throw new Error(`Matcher invalid or not provided`);
        }
    }

    findMatch<K extends keyof TypeMap>(user: FirebaseUser, claims: CustomClaimsToken, hint?: K): TypeMap[K] | TypeMap[keyof TypeMap] | null {

        const name = this.findMatchTypeName(user, claims, hint);
        if(!name) {
            if(this.defaultModel) {
                throw new Error(`Default model "${String(this.defaultModel)}" not found. Please check your spelling and UserModelMap`);
            }
            throw new Error(`No user model found for user ${user.uid}`);
        }
        return this.map[name] as TypeMap[K];
    }

    findMatchTypeName<K extends keyof TypeMap>(user: FirebaseUser, claims: CustomClaimsToken, hint?: K): K | null {

        if(hint && this.checkTypeWithMatcher(user, claims, this.map[hint].matcher)) {
            return hint;

        } else {
            for(const key in this.map) {
                if(this.checkTypeWithMatcher(user, claims, this.map[key].matcher)) {
                    return key as unknown as K;
                }
            }
            if(this.defaultModel) {
                return this.defaultModel as K;
            }
            throw new Error(`No user model found for user ${user.uid}`);
        }
    }

    resolve<K extends keyof TypeMap>(user: FirebaseUser, claims: CustomClaimsToken,  hint?: K): Promise< ReturnType<TypeMap[K]["builder"]> > {
        let match = this.findMatch(user, claims, hint);
        if(!match) {
            throw new Error(`No user model found for user ${user.uid}`);
        }
        return match.builder(user, claims);
    }

    async getClaimsAndResolve<K extends keyof TypeMap>(user: FirebaseUser, hint?: K): Promise< ReturnType<TypeMap[K]["builder"]> > {
        let claims = (await user.getIdTokenResult()).claims;
        return this.resolve(user, claims, hint);
    }
}

export function defineUserModels<T extends UserModelMap>(map: T, options?: UserModelResolverOptions<T>): UserModelResolver<T> {
    return new UserModelResolver(map, options);
}