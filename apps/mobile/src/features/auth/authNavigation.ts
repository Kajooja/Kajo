interface AuthReturnRouter {
  dismissAll(): void;
  replace(path: '/'): void;
}

export function returnToSignedOutLogin(router: AuthReturnRouter) {
  router.dismissAll();
  router.replace('/');
}
