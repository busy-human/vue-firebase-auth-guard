/*
 *   Copyright (c) 2021 to 2025
 *   All rights reserved.
 */
import { User as FirebaseUser, Auth } from "firebase/auth";
import {Callback, CallbackController} from "./callbacks.js";
import {App as VueApp} from "vue";

interface UserWrapper<T> {
    firebaseUser: FirebaseUser | null;
    model: T | null;
    loggedIn: boolean;
}

type PluginCallbackData<T, ExtendedFrom> = ExtendedFrom & {
    plugin: VueUserPlugin<T>;
};

type ModelBuilder<T> = (user: FirebaseUser) => T;

class VueUserPlugin<T> {
    auth: Auth;
    user: UserWrapper<T>;
    modelBuilder?: ModelBuilder<T>;
    onUserModelChangedCallbacks: CallbackController< PluginCallbackData<T, UserWrapper<T>> >;
    onAuthStateChangedCallbacks: CallbackController< PluginCallbackData<T, Auth> >;

    constructor(auth: Auth, modelBuilder?: ModelBuilder<T>) {
        this.auth = auth;
        this.modelBuilder = modelBuilder;
        this.user = {
            firebaseUser: null,
            model: null,
            loggedIn: false
        };
        this.onUserModelChangedCallbacks = new CallbackController();
        this.onAuthStateChangedCallbacks = new CallbackController();
    }

    listen() {
        // Listen for changes to the auth state
        this.auth.onAuthStateChanged(async (userAuth) => {
            if(userAuth) {
                this.updateUserAuth(userAuth);
                if(this.modelBuilder) {
                    const model = await Promise.resolve( this.modelBuilder(userAuth) );
                    return this.updateModel(model);
                }
            } else {
                this.updateUserAuth(null);
                if(this.modelBuilder) {
                    return this.updateModel(null);
                }
            }
        });
    }

    runUserModelChangedCallbacks() {
        return this.onUserModelChangedCallbacks.run(this.user, cb => {
            cb.vm.user = this.user;
        });
    }

    runAuthStateChangedCallbacks() {
        return this.onAuthStateChangedCallbacks.run(this.user, cb => {
            cb.vm.loggedIn = !!this.user;
        });
    }

    /**
     * Allows VueUserPlugin to act as a stand-in for Auth in VueFirebaseAuthPlugin
     * Which enables you to use the transformed user in
     * @param {*} cb
     */
    onAuthStateChanged(cb: Callback<UserWrapper<T>>) {
        if(this.user) {
            cb(this.user);
        } else {
            this.onUserModelChangedCallbacks.add(cb, {
                once: false
            });
        }
    }

    updateUserAuth(user: FirebaseUser | null) {
        this.user.firebaseUser = user;
        this.user.loggedIn = !!user;
        this.runAuthStateChangedCallbacks();
    }

    updateModel(model: T | null) {
        this.user.model = model;
        this.runUserModelChangedCallbacks();
    };



}

interface VueUserPluginInstallOptions {
    auth: Auth,
    modelBuilder: (user: FirebaseUser) => any
}

/**
 * Makes Firebase.auth.currentUser accessible across every vue instance via user
 * Call Vue.use(VueUserPlugin, { auth: firebase.auth() }) to install
 */
export const VueUserPluginBootstrapper = {
    /**
     *
     * @param {*} app
     * @param {*} options - auth, modelBuilder; where the modelBuilder function returns some sort of data structure associated with the user
     */
    install: function<T>(app: VueApp, {auth, modelBuilder}: VueUserPluginInstallOptions) {
        var plugin = new VueUserPlugin<T>(auth);
        plugin.listen();

        app.mixin({
            data() {
                return {
                    user: null
                };
            },
            computed: {
                loggedIn() {
                    return this.user && this.user.loggedIn;
                }
            },
            mounted: function() {
                if(this.$options.onAuthStateChanged) {
                    plugin.onAuthStateChangedCallbacks.add(this.$options.onAuthStateChanged);
                }
                if(this.$options.userModelChanged) {
                    if(!modelBuilder) {
                        console.warn(`[WARN] userModelChanged hook won't be called since no modelBuilder was provided to VueUserPlugin.`)
                    }
                    plugin.onUserModelChangedCallbacks.add(this.$options.userModelChanged);
                } else {
                    plugin.onUserModelChangedCallbacks.add(this.$options.userModelChanged, {
                        once: true
                    });
                }
            }
        });
    }
};

export default VueUserPlugin;