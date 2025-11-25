import { Component, Inject, OnInit } from "@angular/core";
import {
  FormGroup,
  FormBuilder,
  Validators,
  FormControl,
} from "@angular/forms";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { TranslateService } from "@ngx-translate/core";
import { NotifierService } from "angular-notifier";
import {
  catchError,
  EMPTY,
  filter,
  Observable,
  ReplaySubject,
  Subject,
  switchMap,
  takeUntil,
  tap,
} from "rxjs";
import { Entreprise, GroupUser, User } from "src/app/data/models/account";
import { EntrepriseService } from "src/app/data/services/entreprise.service";
import { GroupUserService } from "src/app/data/services/group-user.service";
import { UserService } from "src/app/data/services/user.service";
import { ManageCompHelper } from "src/helper/manage-comp.helper";

@Component({
  selector: "app-add-user",
  templateUrl: "./add-user.component.html",
  styleUrls: ["./add-user.component.scss"],
})
export class AddUserComponent implements OnInit {
  /**
   * List of entreprises
   */
  listEntreprises$: Observable<Array<Entreprise>>;

  /**
   * List of groups
   */
  listGroupes$: Observable<Array<GroupUser>>;

  onInitInstance: () => void;

  /**
   * Emit add user
   */
  onAddUserInstance: () => void;

  /**
   * Emit add user
   */
  onEditUserInstance: () => void;

  /**
   * Emit delete user
   */
  onChangeStatusUserInstance: () => void;

  form: FormGroup = this.formBuilder.group({});
  public destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);

  constructor(
    private formBuilder: FormBuilder,
    public userService: UserService,
    public translate: TranslateService,
    public notifierService: NotifierService,
    public entrepriseService: EntrepriseService,
    public manageCompHelper: ManageCompHelper,
    public groupService: GroupUserService,
    public dialogRef: MatDialogRef<AddUserComponent>,
    @Inject(MAT_DIALOG_DATA) public user: User
  ) {
    this.form.addControl(
      "first_name",
      new FormControl(this.user ? this.user.first_name : null, [
        Validators.required,
      ])
    );

    this.form.addControl(
      "last_name",
      new FormControl(this.user ? this.user.last_name : null, [
        Validators.required,
      ])
    );

    this.form.addControl(
      "is_superuser",
      new FormControl(this.user ? this.user.is_superuser : false, [])
    );

    this.form.addControl(
      "entreprise_id",
      new FormControl(this.user ? this.user.entreprise_id : null, [])
    );

    this.form.addControl(
      "group_id",
      new FormControl(this.user ? this.user.group_id : null, [])
    );

    this.form.addControl(
      "email",
      new FormControl(this.user ? this.user.email : null, [Validators.email])
    );

    this.form.addControl(
      "username",
      new FormControl(this.user ? this.user.username : null,[])
    );

    if (!this.user) {
      this.form.controls["email"].setValidators([
        Validators.email,
        Validators.required,
      ]);
    }

    const onInit: ReplaySubject<void> = new ReplaySubject<void>(1);
    this.onInitInstance = () => {
      onInit.next();
    };

    const onAdd: Subject<void> = new Subject<void>();
    this.onAddUserInstance = () => {
      onAdd.next();
    };

    const onEditUser: Subject<void> = new Subject<void>();
    this.onEditUserInstance = () => {
      onEditUser.next();
    };

    const onChangeStatusUser: Subject<void> = new Subject<void>();
    this.onChangeStatusUserInstance = () => {
      onChangeStatusUser.next();
    };

    onAdd
      .pipe(
        takeUntil(this.destroyed$),
        filter(() => this.form.valid),
        tap(() => {
          this.form.disable();
        }),
        switchMap(() => {
          return this.userService.createUser(this.form.value).pipe(
            catchError((error) => {
              if (error.status == 400 && error.error["email"]) {
                this.notifierService.notify(
                  "error",
                  this.translate.instant(
                    "user.manage_users_dialog.error_duplicated_email"
                  )
                );
              } else {
                this.notifierService.notify(
                  "error",
                  this.translate.instant(
                    "user.manage_users_dialog.error_creating_user"
                  )
                );
              }
              this.form.enable();
              return EMPTY;
            }),
            tap(() => {
              this.form.enable();
              this.form.reset();
              this.dialogRef.close(true);
            })
          );
        })
      )
      .subscribe();

    onEditUser
      .pipe(
        takeUntil(this.destroyed$),
        filter(() => this.form.valid),
        tap(() => {
          this.form.disable();
        }),
        switchMap(() => {
          return this.userService.updateUser(this.form.value, this.user.id).pipe(
            catchError((error) => {
              if (error.status == 400 && error.error["email"]) {
                this.notifierService.notify(
                  "error",
                  this.translate.instant(
                    "user.manage_users_dialog.error_duplicated_email"
                  )
                );
              } else {
                this.notifierService.notify(
                  "error",
                  this.translate.instant(
                    "user.manage_users_dialog.error_updating_user"
                  )
                );
              }
              this.form.enable();
              return EMPTY;
            }),
            tap(() => {
              this.form.enable();
              this.form.reset();
              this.dialogRef.close(true);
            })
          );
        })
      )
      .subscribe();

    onChangeStatusUser
      .pipe(
        takeUntil(this.destroyed$),
        tap(() => {
          this.form.disable();
        }),
        switchMap(() => {
          return this.manageCompHelper
            .openConfirmationDialog([], {
              confirmationTitle: this.translate.instant(
                this.user.is_active
                  ? "user.desactivation_user"
                  : "user.activation_user"
              ),
              confirmationExplanation:
                this.translate.instant(
                  this.user.is_active
                    ? "user.confirmation_desactivation_user"
                    : "user.confirmation_activation_user"
                ) +
                this.user.first_name +
                " " +
                this.user.last_name +
                " ?",
              cancelText: this.translate.instant("cancel"),
              confirmText: this.translate.instant(
                this.user.is_active ? "desactivate" : "activate"
              ),
              danger: this.user.is_active,
            })
            .pipe(
              switchMap((value) => {
                if (value) {
                  const activation = !this.user.is_active;
                  const formData = new FormData();
                  formData.append("is_active", activation.toString());
                  return this.userService
                    .updateUser(formData, this.user.id)
                    .pipe(
                      catchError((error) => {
                        this.notifierService.notify(
                          "error",
                          this.translate.instant(
                            "user.manage_users_dialog.error_changing_status_user"
                          )
                        );
                        this.form.enable();
                        return EMPTY;
                      }),
                      tap(() => {
                        this.form.enable();
                        this.form.reset();
                        this.dialogRef.close(true);
                      })
                    );
                } else {
                  this.form.enable();
                  return EMPTY;
                }
              })
            );
        })
      )
      .subscribe();

    this.listEntreprises$ = onInit.pipe(
      switchMap(() => {
        return this.entrepriseService.getAllEntreprises().pipe(
          catchError(() => {
            this.notifierService.notify(
              "error",
              this.translate.instant(
                "user.manage_entreprises_dialog.error_updating_entreprise"
              )
            );
            return EMPTY;
          })
        );
      })
    );

    this.listGroupes$ = onInit.pipe(
      switchMap(() => {
        return this.groupService.getAllGroupUsers().pipe(
          catchError(() => {
            this.notifierService.notify(
              "error",
              "erreur sur la récupération des groupes"
              // this.translate.instant(
              //   "user.manage_entreprises_dialog.error_updating_entreprise"
              // )
            );
            return EMPTY;
          })
        );
      })
    );
  }

  ngOnInit(): void {
    this.onInitInstance();
  }

  ngOnDestroy(): void {
    this.destroyed$.next(true);
    this.destroyed$.complete();
  }
}

export function toFormData<T>(formValue: T) {
  const formData = new FormData();

  for (const key of Object.keys(formValue)) {
    const value = formValue[key];
    if (value) {
      formData.append(key, value);
    }
    else {
      formData.append(key, null);
    }
  }

  return formData;
}