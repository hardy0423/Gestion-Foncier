import { Component, Inject, OnInit } from "@angular/core";
import {
  FormBuilder,
  FormControl,
  FormGroup,
  Validators,
} from "@angular/forms";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { TranslateService } from "@ngx-translate/core";
import {
  Subject,
  takeUntil,
  tap,
  ReplaySubject,
  catchError,
  EMPTY,
  switchMap,
  filter,
} from "rxjs";
import { MapsService } from "src/app/data/services/maps.service";
import { NotifierService } from "angular-notifier";
import { Group } from "src/app/data/models/type";
import { ManageCompHelper } from "src/helper/manage-comp.helper";

/**
 * Create, edit and delete a group
 */
@Component({
  selector: "app-add-group",
  templateUrl: "./add-group.component.html",
  styleUrls: ["./add-group.component.scss"],
})
export class AddGroupComponent implements OnInit {
  form: FormGroup = this.formBuilder.group({});

  onAddInstance: () => void;

  onUpdateInstance: () => void;

  onDeleteInstance: () => void;

  public destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);

  group: Group;

  constructor(
    private formBuilder: FormBuilder,
    public mapsService: MapsService,
    public translate: TranslateService,
    public notifierService: NotifierService,
    public manageCompHelper: ManageCompHelper,
    public dialogRef: MatDialogRef<AddGroupComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.group = this.data.group;

    this.form.addControl(
      "map_id",
      new FormControl(this.data.profil, [Validators.required])
    );

    this.form.addControl(
      "name",
      new FormControl(this.group ? this.group.name : null, [
        Validators.required,
      ])
    );

    this.form.addControl(
      "color",
      new FormControl(this.group ? this.group.color : null, [
        Validators.required,
      ])
    );

    this.form.addControl(
      "is_visible",
      new FormControl(this.group ? this.group.is_visible : false, [
        Validators.required,
      ])
    );

    if (this.group && this.group.group_id)
      this.form.addControl(
        "group_id",
        new FormControl(this.group.group_id, [Validators.required])
      );

    const onAdd: Subject<void> = new Subject<void>();
    this.onAddInstance = () => {
      onAdd.next();
    };

    const onUpdate: Subject<void> = new Subject<void>();
    this.onUpdateInstance = () => {
      onUpdate.next();
    };

    const onDelete: Subject<void> = new Subject<void>();
    this.onDeleteInstance = () => {
      onDelete.next();
    };

    onAdd
      .pipe(
        takeUntil(this.destroyed$),
        switchMap(() => {
          return this.mapsService.addGroup(this.form.value).pipe(
            catchError(() => {
              this.notifierService.notify(
                "error",
                this.translate.instant("layer.error_loading_group.create")
              );
              return EMPTY;
            }),
            tap((_) => {
              this.dialogRef.close(true);
            })
          );
        })
      )
      .subscribe();

    onUpdate
      .pipe(
        takeUntil(this.destroyed$),
        switchMap(() => {
          return this.mapsService.updateGroup(this.form.value).pipe(
            catchError(() => {
              this.notifierService.notify(
                "error",
                this.translate.instant("layer.error_loading_group.update")
              );
              return EMPTY;
            }),
            tap((_) => {
              this.dialogRef.close(true);
            })
          );
        })
      )
      .subscribe();

    onDelete
      .pipe(
        takeUntil(this.destroyed$),
        switchMap(() => {
          return this.manageCompHelper
            .openConfirmationDialog([], {
              confirmationTitle: this.translate.instant("layer.delete_group"),
              confirmationExplanation:
                this.translate.instant("layer.delete_a_group") +
                this.group.name +
                " ?",
              cancelText: this.translate.instant("cancel"),
              confirmText: this.translate.instant("delete"),
              danger: true,
            })
            .pipe(
              filter((resultConfirmation) => resultConfirmation),
              switchMap(() => {
                return this.mapsService.deleteGroup(this.form.value).pipe(
                  catchError(() => {
                    this.notifierService.notify(
                      "error",
                      this.translate.instant("layer.error_loading_group.delete")
                    );
                    return EMPTY;
                  }),
                  tap((_) => {
                    this.dialogRef.close(true);
                  })
                );
              })
            );
        })
      )
      .subscribe();
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.destroyed$.next(true);
    this.destroyed$.complete();
  }

  close(): void {
    this.dialogRef.close(false);
  }
}
