import { HttpErrorResponse } from "@angular/common/http";
import { Component, Inject, OnInit } from "@angular/core";
import { FormBuilder, FormControl, FormGroup, Validators } from "@angular/forms";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { TranslateService } from "@ngx-translate/core";
import { NotifierService } from "angular-notifier";
import { catchError, EMPTY, filter, ReplaySubject, Subject, switchMap, takeUntil, tap } from "rxjs";
import { Group, Layer } from "src/app/data/models/type";
import { MapsService } from "src/app/data/services/maps.service";

@Component({
  selector: "app-change-group-modal",
  templateUrl: "./change-group-modal.component.html",
  styleUrls: ["./change-group-modal.component.scss"],
})
export class ChangeGroupModalComponent implements OnInit {
  form: FormGroup

  onSubmitInstance: () => void;

  public destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);
  private readonly notifier: NotifierService;

  constructor(
    private formBuilder: FormBuilder,
    public dialogRef: MatDialogRef<ChangeGroupModalComponent>,
    public mapsService: MapsService,
    public translate: TranslateService,
    public notifierService: NotifierService,
    @Inject(MAT_DIALOG_DATA) public data: { layer: Layer; groups: Group[] }
  ) {
    this.notifier = notifierService;
    this.form = this.formBuilder.group({
      group_id: new FormControl([this.data.layer.group], [Validators.required])
    })

    const onSubmit: Subject<void> = new Subject<void>();
    this.onSubmitInstance = () => {
      onSubmit.next();
    };

    onSubmit.pipe(
      takeUntil(this.destroyed$),
      filter(() => this.form.valid),
      tap(()=> {
        this.form.disable()
      }),
      switchMap(()=> {
        let layer = this.data.layer
        layer.group = this.form.get('group_id').value[0]
        return this.mapsService.updateLayer(toFormData(layer), layer.layer_id).pipe(
          catchError((error: HttpErrorResponse) => {
            this.form.enable()
            this.notifier.notify("error", error.error?.msg ? error.error.msg : this.translate.instant('layer.error_editing_layer'))
            return EMPTY
          }),
          tap((layer) => { this.dialogRef.close(layer); })
        )
      })

    ).subscribe()
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

export function toFormData<T>( formValue: T ) {
  const formData = new FormData();

  for ( const key of Object.keys(formValue) ) {
    const value = formValue[key];
    formData.append(key, value);
  }

  return formData;
}
