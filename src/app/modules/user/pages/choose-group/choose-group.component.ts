import { Component, Inject, OnInit } from "@angular/core";
import {
  FormGroup,
  FormBuilder,
  FormControl,
  Validators,
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
import { GroupUser } from "src/app/data/models/account";
import { User } from "src/app/data/models/type";
import { GroupUserService } from "src/app/data/services/group-user.service";

@Component({
  selector: "app-choose-group",
  templateUrl: "./choose-group.component.html",
  styleUrls: ["./choose-group.component.scss"],
})
export class ChooseGroupComponent implements OnInit {
  onInitInstance: () => void;

  /**
   * Emit add
   */
  onAddInstance: () => void;

  /**
   * List of groups
   */
  listGroupes$: Observable<Array<GroupUser>>;

  form: FormGroup = this.formBuilder.group({});

  public destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);

  constructor(
    private formBuilder: FormBuilder,
    public groupService: GroupUserService,
    public translate: TranslateService,
    public notifierService: NotifierService,
    public dialogRef: MatDialogRef<ChooseGroupComponent>,
    @Inject(MAT_DIALOG_DATA) public users: User[]
  ) {
    this.form.addControl(
      "group_id",
      new FormControl(null, [Validators.required])
    );

    const onInit: ReplaySubject<void> = new ReplaySubject<void>(1);
    this.onInitInstance = () => {
      onInit.next();
    };

    const onAdd: Subject<void> = new Subject<void>();
    this.onAddInstance = () => {
      onAdd.next();
    };

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

    onAdd
      .pipe(
        takeUntil(this.destroyed$),
        filter(() => this.form.valid),
        tap(() => {
          this.form.disable();
        }),
        switchMap(() => {
          let data = {
            group_id: this.form.get("group_id").value,
            action: "add",
            users: this.users
          }

          return this.groupService
            .editGroupUser(this.form.get("group_id").value, data)
            .pipe(
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
  }

  ngOnInit(): void {
    this.onInitInstance();
  }

  ngOnDestroy(): void {
    this.destroyed$.next(true);
    this.destroyed$.complete();
  }
}
