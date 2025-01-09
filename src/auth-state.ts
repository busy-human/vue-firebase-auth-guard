import { Auth, User as FirebaseUser, ParsedToken as CustomClaimsToken } from "firebase/auth";
import { FirebaseError } from "@firebase/util";
import { UserModelMap, UserModelResolver } from "./user-model-resolver.js";
import { CallbackController, Callback } from "./callbacks.js";

interface AuthStateCallbackData<TypeMap extends UserModelMap> {
    firebaseUser: FirebaseUser | null;
    userModel: TypeMap[any] | null;
    claims: CustomClaimsToken | null;
    loggedIn: boolean;
    hasCheckedForSession: boolean;
}

interface AuthLogOutOptions {
    cleanup?: boolean;
}

type AuthEvent = "authenticated" | "unauthenticated" | "auth_checked" | "auth_error" | "model_updated" | "claims_updated";

const AuthErrorMap: {[code: string]: string} = {
    'auth/invalid-email': "Invalid Email",
    'auth/user-not-found': "User Not Found",
    'auth/wrong-password': "Password Invalid",
    'auth/email-already-in-use': "Email Already In Use"
};

export class AuthStateClass<TypeMap extends UserModelMap> {
    auth                        : Auth;
    firebaseUser                : FirebaseUser | null;
    userModel                   : TypeMap[any] | null;
    claims                      : CustomClaimsToken | null;
    resolver                   ?: UserModelResolver<TypeMap>;
    hasCheckedForSession        : boolean = false;
    private onAuthStateChangedCallbacks : CallbackController<AuthStateCallbackData<TypeMap>>;

    constructor(auth: Auth, resolver?: UserModelResolver<TypeMap>) {
        this.auth = auth;
        this.firebaseUser = null;
        this.userModel = null;
        this.resolver = resolver;
        this.claims = null;
        this.onAuthStateChangedCallbacks = new CallbackController<AuthStateCallbackData<TypeMap>>();
    }

    get loggedIn() {
        return !!this.auth.currentUser;
    }

    makeAuthChangeEvent(eventName:AuthEvent) {
        return {
            firebaseUser         : this.firebaseUser,
            userModel            : this.userModel,
            claims               : this.claims,
            loggedIn             : this.loggedIn,
            hasCheckedForSession : this.hasCheckedForSession,
            eventName            : eventName,
        };
    }

    startListener() {
        // Listen for changes to the auth state
        this.auth.onAuthStateChanged(async (user) => {
            try {
                let eventName: AuthEvent;
                if(user) {
                    this.firebaseUser = user;
                    this.claims = (await user.getIdTokenResult()).claims;
                    if(this.resolver) {
                        this.userModel = await this.resolver.resolve(user, this.claims);
                    }
                    eventName = "authenticated";
                } else {
                    this.firebaseUser = null;
                    this.userModel = null;
                    this.claims = null;
                    eventName = "unauthenticated";
                }
                this.hasCheckedForSession = true;

                // Run callbacks (if any)
                this.onAuthStateChangedCallbacks.run( this.makeAuthChangeEvent(eventName) );
            } catch(err: any) {
                if("code" in err) {
                    this.logFirebaseError(err.code);
                } else {
                    console.warn("An error occurred while trying to refresh claims:", err.message);
                }
            }
        });
    }

    convertAuthError(errorCode: string) {
        // return AuthErrorMap[errorCode] || "Unknown"
        return AuthErrorMap[errorCode] || errorCode;
    }

    logFirebaseError(errorCode: string) {
        const readable = this.convertAuthError(errorCode);
        console.warn(readable);
    }

    onChange(cb: Callback<AuthStateCallbackData<TypeMap>>, options: {once: boolean} = { once: false }) {
        this.onAuthStateChangedCallbacks.add(cb, { once: options.once });
    }

    async refreshClaims() {
        if(this.loggedIn && this.firebaseUser) {
            this.claims = (await this.firebaseUser.getIdTokenResult()).claims;
            if(this.resolver) {
                this.userModel = await this.resolver.resolve(this.auth.currentUser!, this.claims);
            }

            // Run callbacks (if any)
            this.onAuthStateChangedCallbacks.run( this.makeAuthChangeEvent("claims_updated") );

            return this.claims;
        } else {
            throw new Error("Cannot refresh claims when not authenticated.");
        }
    }

    waitForAuthCheck() {
        return new Promise((resolve) => {
            if(this.hasCheckedForSession) {
                resolve( this.makeAuthChangeEvent("auth_checked") );
            } else {
                this.onAuthStateChangedCallbacks.add((data) => {
                    if(data.hasCheckedForSession) {
                        resolve(data);
                    }
                }, { once: true });
            }
        });
    }

    async logOut(options: AuthLogOutOptions = { cleanup: false }) {
        await this.auth.signOut();
        this.firebaseUser = null;
        this.userModel = null;
        this.hasCheckedForSession = false;

        // Run callbacks (if any)
        this.onAuthStateChangedCallbacks.run( this.makeAuthChangeEvent("unauthenticated") );

        if(options.cleanup) {
            // Clear any pending callbacks
            this.onAuthStateChangedCallbacks.cleanup();
        }
    }
}

export let MainAuth: AuthStateClass<any>;

export function initializeAuthState<TypeMap extends UserModelMap>(auth: Auth, resolver?: UserModelResolver<TypeMap>) {
    if(MainAuth) {
        console.warn("AuthState already initialized, will only initialize once.");
        return MainAuth;
    }

    MainAuth = new AuthStateClass(auth, resolver);
    MainAuth.startListener();

    return MainAuth;
}

export function assertMainAuth() {
    if(!MainAuth) {
        throw new Error('MainAuth not initialized, please ensure to call initializeAuthState first');
    }
}