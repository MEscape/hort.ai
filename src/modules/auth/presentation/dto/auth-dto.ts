/** What a successful sign-in returns: where to go next, already checked as same-site. */
export interface SignInDto {
  readonly redirectTo: string;
}
