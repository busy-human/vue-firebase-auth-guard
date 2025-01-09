/*
 *   Copyright (c) 2021 Busy Human LLC
 *   All rights reserved.
 *   This file, its contents, concepts, methods, behavior, and operation  (collectively the "Software") are protected by trade secret, patent,  and copyright laws. The use of the Software is governed by a license  agreement. Disclosure of the Software to third parties, in any form,  in whole or in part, is expressly prohibited except as authorized by the license agreement.
 */
import { Auth, User as FirebaseUser, ParsedToken as CustomClaimsToken } from "firebase/auth";
import {ref, Ref} from "vue";
import {Callback, CallbackController} from "./callbacks.js";
import { UserModelMap, UserModelResolver } from "./user-model-resolver.js";
import { MainAuth, initializeAuthState } from "./auth-state.js";

// Authentication Lifecycle

interface IGlobals {
    initialized  : boolean;
    user         : Ref<FirebaseUser | null>;
    model        : Ref<any | null>;
    claims       : Ref<CustomClaimsToken | null>;
    authReady    : Ref<boolean>;
    uid          : Ref<string | null>;
    authenticated: Ref<boolean>;
    onAuth       : CallbackController<any>;
    onUnauth     : CallbackController<any>;
    onAuthChecked: CallbackController<any>;
}

const globals: IGlobals = {
    initialized   : false,
    user          : ref(null),
    model         : ref(null),
    authenticated : ref(false),
    claims        : ref(null),
    authReady     : ref(false),
    uid           : ref(null),
    onAuth        : new CallbackController(),
    onUnauth      : new CallbackController(),
    onAuthChecked : new CallbackController()
};


function initialize(auth: Auth, resolver?: UserModelResolver<UserModelMap>) {
    initializeAuthState(auth, resolver);

    if(!globals.initialized) {
        globals.initialized   = true;
        globals.user          = ref(null);
        globals.model         = ref(null);
        globals.authenticated = ref(false);
        globals.claims        = ref(null);
        globals.authReady     = ref(false);
        globals.uid           = ref(null);

        MainAuth.onChange((userAuth) => {
            globals.user.value = userAuth.firebaseUser;
            globals.model.value = userAuth.userModel;
            globals.authenticated.value = userAuth.loggedIn;
            globals.claims.value = userAuth.claims;
            globals.uid.value = userAuth.firebaseUser?.uid || null;
            globals.authReady.value = true;

            if(userAuth.loggedIn) {
                globals.onAuth.run(globals.user.value);
            } else {
                globals.onUnauth.run(globals.user.value);
            }
        });
    }
}

/**
 *
 * @param {import("@types/firebase")} [auth]
 */
function install(auth: Auth) {
    initialize(auth);
}

export function useVueUserComposition() {
    return VueUserComposition;
}

export const VueUserComposition = {
    install       : install,
    user          : globals.user,
    userspace     : globals.model,
    authenticated : globals.authenticated,
    claims        : globals.claims,
    authReady     : globals.authReady,
    uid           : globals.uid,
    onAuth        : (cb: Callback<FirebaseUser>) => globals.onAuth.add(cb),
    onUnauth      : (cb: Callback<void>) => globals.onUnauth.add(cb),
    onAuthChecked : (cb: Callback<FirebaseUser|null>) => globals.onAuthChecked.add(cb)
};