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
  ReplaySubject,
  Subject,
  switchMap,
  takeUntil,
  tap,
} from "rxjs";
import { Entreprise } from "src/app/data/models/account";
import { EntrepriseService } from "src/app/data/services/entreprise.service";
import { ManageCompHelper } from "src/helper/manage-comp.helper";

@Component({
  selector: "app-add-entreprise",
  templateUrl: "./add-entreprise.component.html",
  styleUrls: ["./add-entreprise.component.scss"],
})
export class AddEntrepriseComponent implements OnInit {
  onInitInstance: () => void;

  /**
   * Emit add entreprise
   */
  onAddEntrepriseInstance: () => void;

  /**
   * Emit add entreprise
   */
  onEditEntrepriseInstance: () => void;

  /**
   * Emit delete entreprise
   */
  onDeleteEntrepriseInstance: () => void;
  form: FormGroup = this.formBuilder.group({});
  public destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);

  constructor(
    private formBuilder: FormBuilder,
    public entrepriseService: EntrepriseService,
    public translate: TranslateService,
    public notifierService: NotifierService,
    public manageCompHelper: ManageCompHelper,
    public dialogRef: MatDialogRef<AddEntrepriseComponent>,
    @Inject(MAT_DIALOG_DATA) public entreprise: Entreprise
  ) {
    this.form.addControl(
      "name",
      new FormControl(this.entreprise ? this.entreprise.name : null, [
        Validators.required,
      ])
    );

    const onInit: ReplaySubject<void> = new ReplaySubject<void>(1);
    this.onInitInstance = () => {
      onInit.next();
    };

    const onAdd: Subject<void> = new Subject<void>();
    this.onAddEntrepriseInstance = () => {
      onAdd.next();
    };

    const onEditEntreprise: Subject<void> = new Subject<void>();
    this.onEditEntrepriseInstance = () => {
      onEditEntreprise.next();
    };

    const onDeleteEntreprise: Subject<void> = new Subject<void>();
    this.onDeleteEntrepriseInstance = () => {
      onDeleteEntreprise.next();
    };

    onAdd
      .pipe(
        takeUntil(this.destroyed$),
        filter(() => this.form.valid),
        tap(() => {
          this.form.disable();
        }),
        switchMap(() => {
          let data: Entreprise = {
            name: this.form.get("name").value,
          };
          return this.entrepriseService.createEntreprise(data).pipe(
            catchError((error) => {
              if (error.status == 400 && error.error["name"]) {
                this.notifierService.notify(
                  "error",
                  this.translate.instant(
                    "entreprise.manage_entreprises_dialog.error_duplicated_name"
                  )
                );
              } else {
                this.notifierService.notify(
                  "error",
                  this.translate.instant(
                    "entreprise.manage_entreprises_dialog.error_creating_entreprise"
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

    onEditEntreprise
      .pipe(
        takeUntil(this.destroyed$),
        filter(() => this.form.valid),
        tap(() => {
          this.form.disable();
        }),
        switchMap(() => {
          let data: Entreprise = {
            name: this.form.get("name").value,
          };
          return this.entrepriseService
            .editEntreprise(this.entreprise.entreprise_id, data)
            .pipe(
              catchError((error) => {
                if (error.status == 400 && error.error["name"]) {
                  this.notifierService.notify(
                    "error",
                    this.translate.instant(
                      "entreprise.manage_entreprises_dialog.error_duplicated_name"
                    )
                  );
                } else {
                  this.notifierService.notify(
                    "error",
                    this.translate.instant(
                      "entreprise.manage_entreprises_dialog.error_updating_entreprise"
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

    onDeleteEntreprise
      .pipe(
        takeUntil(this.destroyed$),
        tap(() => {
          this.form.disable();
        }),
        switchMap(() => {
          return this.manageCompHelper
            .openConfirmationDialog([], {
              confirmationTitle: this.translate.instant(
                "entreprise.delete_entreprise"
              ),
              confirmationExplanation:
                this.translate.instant(
                  "entreprise.confirmation_suppression_entreprise"
                ) +
                this.entreprise.name +
                " ?",
              cancelText: this.translate.instant("cancel"),
              confirmText: this.translate.instant("delete"),
              danger: true,
            })
            .pipe(
              switchMap((value) => {
                if (value) {
                  return this.entrepriseService
                    .deleteEntreprise(this.entreprise.entreprise_id)
                    .pipe(
                      catchError((error) => {
                        this.notifierService.notify(
                          "error",
                          this.translate.instant(
                            "entreprise.manage_entreprises_dialog.error_delete_entreprise"
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
  }

  ngOnInit(): void {
    this.onInitInstance();
  }

  ngOnDestroy(): void {
    this.destroyed$.next(true);
    this.destroyed$.complete();
  }
}
