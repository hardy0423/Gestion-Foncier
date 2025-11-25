import { HttpErrorResponse } from '@angular/common/http';
import { Component, Inject, OnInit } from '@angular/core';
import { FormGroup, FormBuilder, FormControl, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { NotifierService } from 'angular-notifier';
import { catchError, EMPTY, filter, ReplaySubject, Subject, switchMap, takeUntil, tap } from 'rxjs';
import { MapsService } from 'src/app/data/services/maps.service';
import { EditStyleComponent } from 'src/app/modules/layer/pages/layer-style/edit-style/edit-style.component';

@Component({
  selector: 'app-upload-file-data',
  templateUrl: './upload-file-data.component.html',
  styleUrls: ['./upload-file-data.component.scss']
})
export class UploadFileDataComponent implements OnInit {

  public ondUpdateInstance: () => void;
  private readonly notifier: NotifierService;
  private destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);
  form: FormGroup
  loading: boolean = false;

  constructor(
    public dialogRef: MatDialogRef<EditStyleComponent>,
    private formBuilder: FormBuilder,
    public mapsService: MapsService,
    notifierService: NotifierService,
    @Inject(MAT_DIALOG_DATA) public join_table: string,
    public translate: TranslateService) {
    this.notifier = notifierService;

    this.form = this.formBuilder.group({
      xls_file: new FormControl(null, [Validators.required]),
    })

    const ondUpdate: Subject<void> = new Subject<void>()
    this.ondUpdateInstance = () => {
      ondUpdate.next()
    }

    ondUpdate.pipe(
      filter(() => this.form.valid),
      tap(() => { this.form.disable() }),
      switchMap(() => {
        let style = toFormData({
          'file': this.form.get('xls_file').value[0],
          'table': this.join_table
        })
        return this.mapsService.replaceJoinTable(style)
          .pipe(
            catchError((value: HttpErrorResponse) => {
              if (value.error.msg) {
                this.notifier.notify("error", value.error.msg)
              }
              else {
                this.notifier.notify("error", this.translate.instant( "map.attribute_tables.error_updating_features"))
              }
              this.loading = false; this.form.enable()
              return EMPTY
            }),
            tap((res) => { this.loading = false; this.form.enable(); this.dialogRef.close(res) })
          )
      }),
      takeUntil(this.destroyed$)
    ).subscribe()

  }

  ngOnInit(): void {
  }

  ngOnDestroy(): void {
    this.destroyed$.next(true);
    this.destroyed$.complete();
  }

  close(): void {
    this.dialogRef.close(false);
  }

}

export function toFormData<T>(formValue: T) {
  const formData = new FormData();

  for (const key of Object.keys(formValue)) {
    const value = formValue[key];
    formData.append(key, value);
  }

  return formData;
}
