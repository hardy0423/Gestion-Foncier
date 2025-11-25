import { Component, OnInit } from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { ActivatedRoute, ParamMap, Router } from "@angular/router";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import {
  ReplaySubject,
  takeUntil,
  tap,
  catchError,
  EMPTY,
  switchMap,
  Observable,
  Subject,
  merge,
  withLatestFrom,
  filter,
  take,
} from "rxjs";
import { User } from "src/app/data/models/account";
import { TranslateService } from "@ngx-translate/core";
import { NotifierService } from "angular-notifier";
import { AuthService } from "src/app/core/service/auth.service";
import { StoreService } from "src/app/data/store/store.service";
import { UserService } from "src/app/data/services/user.service";

@Component({
  selector: "app-login",
  templateUrl: "./login.component.html",
  styleUrls: ["./login.component.scss"],
})
export class LoginComponent implements OnInit {
  /**
   * control email field before showing password view
   */
  onSubmitEmailInstance: () => void;

  /**
   * control password field and login
   */
  onSubmitPasswordInstance: () => void;

  /**
   * add new password and login
   */
  onUpdatePasswordInstance: () => void;

  /**
   * set user
   */
  setUserInstance: (user: User) => void;

  /**
   * send mail for password forgot
   */
  onForgotPasswordInstance: () => void;

  /** The form group for email and password */
  form: FormGroup;

  // Classes to manage on CSS
  fieldPasswordClass: HTMLElement;
  fieldEmailClass: HTMLElement;
  helloUserClass: HTMLElement;
  textForgetPasswordClass: HTMLElement;
  radioClass: HTMLElement;
  radioValueClass: HTMLElement;
  planeClasses: HTMLCollectionOf<HTMLElement>;
  planeClass: HTMLElement;
  buttonBackClass: HTMLElement;
  buttonNextClass: HTMLElement;
  loadingClass: HTMLElement;

  user$: Observable<User>;
  urlSlugValid: string;
  user: User;
  name: String;
  hide: boolean = true;

  showPassword: boolean = false;
  isLoadingLogin: boolean = false;

  public destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);

  constructor(
    public router: Router,
    private formBuilder: FormBuilder,
    public store: StoreService,
    public authService: AuthService,
    private userService: UserService,
    public translate: TranslateService,
    private activatedRoute: ActivatedRoute,
    public notifierService: NotifierService
  ) {
    this.form = this.formBuilder.group({
      username: [
        null,
        {
          validators: [Validators.required],
        },
      ],
      password: [
        null,
        {
          validators: [Validators.required, Validators.minLength(4)],
        },
      ],
    });

    const onSetUser: Subject<User> = new Subject<User>();
    this.setUserInstance = (user) => {
      onSetUser.next(user);
    };

    const onSubmitEmail: ReplaySubject<void> = new ReplaySubject<void>(1);
    this.onSubmitEmailInstance = () => {
      onSubmitEmail.next();
    };

    const onSubmitPassword: ReplaySubject<void> = new ReplaySubject<void>(1);
    this.onSubmitPasswordInstance = () => {
      onSubmitPassword.next();
    };

    const onUpdatePassword: ReplaySubject<void> = new ReplaySubject<void>(1);
    this.onUpdatePasswordInstance = () => {
      onUpdatePassword.next();
    };

    this.user$ = merge(
      onSetUser,
      this.activatedRoute.paramMap.pipe(
        filter((params) => params.get("slug") != undefined),
        switchMap((params: ParamMap) => {
          return this.userService.getUserSlug(params.get("slug")).pipe(
            catchError(() => {
              this.notifierService.notify(
                "error",
                this.translate.instant("login.user_not_found")
              );
              return EMPTY;
            }),
            tap((user) => {
              this.user = user;
              this.name = user.email ? user.email : user.username;
              this.urlSlugValid = params.get("slug");
              this.form
                .get("username")
                .setValue(user.email ? user.email : user.username);
              this.animationsPassword(true);
            })
          );
        })
      )
    );

    onSubmitEmail
      .pipe(
        takeUntil(this.destroyed$),
        tap(() => {
          this.form.get("username").valid;
        }),
        switchMap(() => {
          this.isLoadingLogin = true;
          this.form.get("username").disable();
          return this.userService
            .userByEmailOrUsername(this.form.get("username").value)
            .pipe(
              catchError(() => {
                this.form.get("username").enable();
                this.notifierService.notify(
                  "error",
                  this.translate.instant("login.user_not_found")
                );
                this.form.get("username").enable();
                this.isLoadingLogin = false;
                return EMPTY;
              }),
              tap((user) => {
                this.user = user;
                this.name = user.email ? user.email : user.username;
                this.form.get("username").enable();
                this.isLoadingLogin = false;
                if (user.username || user.email) {
                  this.urlSlugValid
                    ? this.animationsPassword(true)
                    : this.animationsPassword();
                } else {
                  this.form
                    .get("username")
                    .setErrors(!!user.email ? null : { invalidAsync: true });
                }
              })
            );
        })
      )
      .subscribe();

    onSubmitPassword
      .pipe(
        takeUntil(this.destroyed$),
        switchMap(() => {
          this.isLoadingLogin = true;
          this.form.disable();
          return this.authService
            .login(
              this.form.get("username").value,
              this.form.get("password").value
            )
            .pipe(
              catchError((error: HttpErrorResponse) => {
                this.form.enable();
                this.notifierService.notify(
                  "error",
                  this.translate.instant(
                    error.status == 401
                      ? "login.wrong_password"
                      : "login.impossible_to_connect"
                  )
                );
                this.isLoadingLogin = false;
                return EMPTY;
              }),
              switchMap(() => {
                this.isLoadingLogin = false;
                return this.store.loadUser();
              }),
              tap((user) => {
                this.animationsLoading();
                setTimeout(() => {
                  this.notifierService.notify(
                    "success",
                    this.translate.instant("login.connection_success")
                  );
                }, 1500);
                setTimeout(() => {
                  this.router.navigate(["map"]);
                }, 2000);
              })
            );
        })
      )
      .subscribe();

    onUpdatePassword
      .pipe(
        takeUntil(this.destroyed$),
        withLatestFrom(this.user$),
        switchMap((param) => {
          this.isLoadingLogin = true;
          this.form.disable();
          return this.userService
            .updatePasswordUser({
              password: this.form.get("password").value,
              slug: param[1].slug,
            })
            .pipe(
              catchError((error: HttpErrorResponse) => {
                this.notifierService.notify(
                  "error",
                  this.translate.instant("login.invalid_password")
                );
                this.isLoadingLogin = false;
                return EMPTY;
              }),
              switchMap(() => {
                return this.authService
                  .login(
                    this.form.get("username").value,
                    this.form.get("password").value
                  )
                  .pipe(
                    catchError((error: HttpErrorResponse) => {
                      this.isLoadingLogin = false;
                      this.form.enable();
                      this.notifierService.notify(
                        "error",
                        this.translate.instant(
                          error.status == 401
                            ? "login.wrong_password"
                            : "login.impossible_to_connect"
                        )
                      );
                      return EMPTY;
                    }),
                    switchMap(() => {
                      this.isLoadingLogin = false;
                      return this.store.loadUser();
                    }),
                    tap((user) => {
                      this.animationsLoading();
                      setTimeout(() => {
                        this.notifierService.notify(
                          "success",
                          this.translate.instant("login.connection_success")
                        );
                      }, 1500);
                      setTimeout(() => {
                        this.router.navigate(["map"]);
                      }, 2000);
                    })
                  );
              })
            );
        })
      )
      .subscribe();

    this.onForgotPasswordInstance = () => {
      if (!this.user.is_from_ldap && this.user.email) {
        this.animationsSendMail();
        this.form.disable();
        this.userService
          .userForgotPassword(this.user.email)
          .pipe(
            take(1),
            catchError(() => {
              this.notifierService.notify(
                "error",
                this.translate.instant("login.send_mail_error")
              );
              this.form.enable();
              this.animationsPassword();
              return EMPTY;
            }),
            tap((_) => {
              this.form.enable();
              this.notifierService.notify(
                "success",
                this.translate.instant("login.mail_sent")
              );
              this.animationsPassword(true);
            })
          )
          .subscribe();
      } else {
        this.notifierService.notify(
          "error",
          this.translate.instant(
            this.user.is_from_ldap
              ? "login.cannot_retrieve_password_ldap"
              : "login.no_email"
          )
        );
      }
    };
  }

  ngOnInit(): void {}

  /**
   * on destroy
   */
  ngOnDestroy(): void {
    this.destroyed$.next(true);
    this.destroyed$.complete();
  }

  /**
   * go to the view password
   */
  animationsPassword(newPassword?: boolean) {
    this.showPassword = true;
    // animations on email
    this.fieldEmailClass.classList.add(
      "animate__fadeOut",
      "hidden-element-field"
    );
    // animations on password
    this.fieldPasswordClass.classList.remove(
      "hidden-element-field",
      "animate__fadeOut"
    );
    this.fieldPasswordClass.classList.add("animate__fadeIn");

    if (!newPassword) {
      this.textForgetPasswordClass.classList.remove(
        "hidden-element",
        "hidden-element-position",
        "animate__fadeOut"
      );
      this.textForgetPasswordClass.classList.add("animate__fadeIn");
    }

    this.helloUserClass.classList.remove(
      "hidden-element",
      "hidden-element-position",
      "animate__fadeOut"
    );
    this.helloUserClass.classList.add("animate__fadeIn");

    // animations on plane
    this.planeClasses[0].style.removeProperty("margin-top");
    this.planeClass.classList.remove(
      "plane-password-to-email",
      "plane-password-to-loading",
      "plane-email-to-password"
    );
    this.planeClass.classList.add("plane-email-to-password");
    // animations on radio
    this.radioClass.classList.remove("animate__fadeOut", "hidden-element");
    this.radioClass.classList.add("animate__fadeIn");
    this.radioValueClass.classList.remove("move-email");
    this.radioValueClass.classList.add("move-password");

    // animations on button back to email
    this.buttonBackClass.classList.remove("animate__fadeOut", "hidden-element");
    this.buttonBackClass.classList.add("animate__fadeIn");
    // hide loading
    this.loadingClass.classList.add("hidden-element");
    // show button connect
    this.buttonNextClass.classList.remove("animate__fadeOut");
    this.buttonNextClass.classList.add("animate__fadeIn");
  }

  /**
   * return to the view email
   */
  animationsEmail() {
    this.showPassword = false;
    // animations on password "hide"
    this.fieldPasswordClass.classList.add(
      "animate__fadeOut",
      "hidden-element-field"
    );
    this.textForgetPasswordClass.classList.add("animate__fadeOut");
    this.helloUserClass.classList.add("animate__fadeOut");
    // animations on email (remove all animations before, add new animations )
    this.fieldEmailClass.classList.remove(
      "animate__fadeOut",
      "hidden-element-field"
    );
    this.fieldEmailClass.classList.add("animate__fadeIn");
    // animations on radio
    this.radioValueClass.classList.remove("move-password");
    this.radioValueClass.classList.add("move-email");
    this.planeClass.classList.remove(
      "plane-email-to-password",
      "plane-password-to-loading",
      "plane-loading-to-password"
    );
    this.planeClass.classList.add("plane-password-to-email");
    // animations on button back to email
    this.buttonBackClass.classList.remove("animate__fadeIn");
    this.buttonBackClass.classList.add("animate__fadeOut");
    // hide loading
    this.loadingClass.classList.add("hidden-element");
  }

  /**
   * connect to the app
   */
  animationsLoading() {
    // hide the view password
    this.fieldPasswordClass.classList.add("animate__fadeOut");
    this.textForgetPasswordClass.classList.add(
      "animate__fadeOut",
      "hidden-element-position"
    );

    this.helloUserClass.classList.add(
      "animate__fadeOut",
      "hidden-element-position"
    );

    this.radioClass.classList.add("animate__fadeOut", "hidden-element");
    this.buttonBackClass.classList.add("animate__fadeOut");
    this.buttonNextClass.classList.add("animate__fadeOut");

    // manage animations on the plane
    this.planeClass.classList.remove(
      "plane-password-to-email",
      "plane-password-to-loading",
      "plane-loading-to-password",
      "plane-email-to-password"
    );
    this.planeClass.classList.add("plane-password-to-loading");
    // show loading
    this.loadingClass.classList.remove("hidden-element");
    this.loadingClass.classList.add("animate__fadeIn");
  }

  ngAfterViewInit() {
    // define all classes to manage the animations
    this.fieldEmailClass = document.querySelector(".field-email");
    this.fieldPasswordClass = document.querySelector(".field-password");
    this.textForgetPasswordClass = document.querySelector(".forget-password");
    this.helloUserClass = document.querySelector(".hello-user");
    this.radioClass = document.querySelector(".radio-element");
    this.radioValueClass = document.querySelector(".radio-checked");
    this.buttonBackClass = document.querySelector(".go-to-email");
    this.buttonNextClass = document.querySelector(".go-to-next");
    this.loadingClass = document.querySelector(".loading");
    this.planeClass = document.querySelector(".plane");
    this.planeClasses = document.getElementsByClassName(
      "plane"
    ) as HTMLCollectionOf<HTMLElement>;
    // show the field email
    this.fieldEmailClass.classList.add("animate__fadeIn");
    this.radioClass.classList.add("animate__fadeIn");
    // hide the field password and text forget password
    this.fieldPasswordClass.classList.add("hidden-element-field");
    this.textForgetPasswordClass.classList.add("hidden-element");
    this.helloUserClass.classList.add("hidden-element");
    this.buttonBackClass.classList.add("hidden-element");
    // initialize the position of plane on the view email
    this.planeClasses[0].style.marginTop = "80vh";
    // hide loading
    this.loadingClass.classList.add("hidden-element");
  }

  /**
   * show error
   */
  errorValidation(field: number) {
    this.notifierService.notify(
      "error",
      this.translate.instant(
        field == 1 ? "user.email_required" : "user.password_required"
      )
    );
  }

  /**
   * return to the view email
   */
  animationsSendMail() {
    // hide the view password
    this.fieldPasswordClass.classList.add("animate__fadeOut");
    this.helloUserClass.classList.add("animate__fadeOut", "hidden-element");
    this.textForgetPasswordClass.classList.add(
      "animate__fadeOut",
      "hidden-element-position"
    );
    this.radioClass.classList.add("animate__fadeOut", "hidden-element");
    this.buttonBackClass.classList.add("animate__fadeOut");
    this.buttonNextClass.classList.add("animate__fadeOut");
    // show loading
    this.loadingClass.classList.remove("hidden-element");
    this.loadingClass.classList.add("animate__fadeIn");
  }
}
