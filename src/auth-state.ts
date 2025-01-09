import { Auth, User as FirebaseUser, ParsedToken as CustomClaimsToken } from "firebase/auth";
import { UserModelMap, UserModelResolver } from "./user-model-resolver.js";
import { CallbackController, Callback } from "./callbacks.js";

interface AuthStateCallbackData<TypeMap extends UserModelMap> {
    firebaseUser: FirebaseUser | null;
    userModel: TypeMap[any] | null;
    claims: CustomClaimsToken | null;
    loggedIn: boolean;
    hasCheckedForSession: boolean;
}

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

    startListener() {
        // Listen for changes to the auth state
        this.auth.onAuthStateChanged(async (user) => {
            if(user) {
                this.firebaseUser = user;
                this.claims = (await user.getIdTokenResult()).claims;
                if(this.resolver) {
                    this.userModel = await this.resolver.resolve(user, this.claims);
                }
            } else {
                this.firebaseUser = null;
                this.userModel = null;
            }
            this.hasCheckedForSession = true;

            // Run callbacks (if any)
            this.onAuthStateChangedCallbacks.run({
                firebaseUser         : this.firebaseUser,
                userModel            : this.userModel,
                claims               : this.claims,
                loggedIn             : this.loggedIn,
                hasCheckedForSession : this.hasCheckedForSession
            });
        });
    }

    onChange(cb: Callback<AuthStateCallbackData<TypeMap>>, options: {once: boolean} = { once: false }) {
        this.onAuthStateChangedCallbacks.add(cb, { once: options.once });
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