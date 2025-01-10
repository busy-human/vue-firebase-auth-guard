import { Auth, User as FirebaseUser, ParsedToken as CustomClaimsToken } from "firebase/auth";
import { FirebaseError } from "@firebase/util";
import { UserModelResolver } from "./user-model-resolver.js";
import { CallbackController, Callback } from "./callbacks.js";
import { AuthStateCallbackData, AuthEvent, AuthErrorMap, AuthLogOutOptions, AuthRouteMap, UserModelMap } from "./types.js";



export class AuthStateClass<TypeMap extends UserModelMap> {
    auth                        : Auth;
    firebaseUser                : FirebaseUser | null;
    userModel                   : TypeMap[any] | null;
    claims                      : CustomClaimsToken | null;
    userType                    : keyof TypeMap | null;
    resolver                   ?: UserModelResolver<TypeMap>;
    userRoutes                 ?: Partial<AuthRouteMap>;
    hasCheckedForSession        : boolean = false;
    private onAuthStateChangedCallbacks : CallbackController<AuthStateCallbackData<TypeMap, any>>;

    constructor(auth: Auth, resolver?: UserModelResolver<TypeMap>) {
        this.auth = auth;
        this.firebaseUser = null;
        this.userModel = null;
        this.resolver = resolver;
        this.claims = null;
        this.userType = null;
        this.onAuthStateChangedCallbacks = new CallbackController<AuthStateCallbackData<TypeMap, any>>();
    }

    get loggedIn() {
        return !!this.auth.currentUser;
    }

    makeAuthChangeEvent(eventName:AuthEvent) {
        return {
            firebaseUser         : this.firebaseUser,
            userModel            : this.userModel,
            userType             : this.userType,
            claims               : this.claims,
            loggedIn             : this.loggedIn,
            hasCheckedForSession : this.hasCheckedForSession,
            eventName            : eventName,
            routes               : this.userRoutes
        };
    }

    setUserModel<TypeName extends keyof TypeMap>(model: TypeMap[any], typeName: TypeName) {
        this.userModel = model;
        this.userType = typeName;
        this.onAuthStateChangedCallbacks.run( this.makeAuthChangeEvent("model_updated") );
    }

    async resolveUserModel() {
        if(this.resolver && this.firebaseUser && this.claims) {

            this.userType = await this.resolver.findMatchTypeName(this.firebaseUser, this.claims);
            if(!this.userType) {
                throw new Error(`No user model found for user ${this.firebaseUser.uid}`);
            }
            this.userModel = await this.resolver.resolve(this.firebaseUser, this.claims, this.userType);
            this.userRoutes = this.resolver.routesForType(this.userType);
        } else {
            this.userType = null;
            this.userModel = null;
            this.userRoutes = undefined;
        }

        return this.userModel;
    }

    startListener() {
        // Listen for changes to the auth state
        this.auth.onAuthStateChanged(async (user) => {
            try {
                let eventName: AuthEvent;
                if(user) {
                    this.firebaseUser = user;
                    this.claims = (await user.getIdTokenResult()).claims;
                    await this.resolveUserModel();
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
                    console.warn("An error occurred on the auth state manager: ", err.message);
                    console.error(err);
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

    onChange(cb: Callback<AuthStateCallbackData<TypeMap, any>>, options: {once: boolean} = { once: false }) {
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