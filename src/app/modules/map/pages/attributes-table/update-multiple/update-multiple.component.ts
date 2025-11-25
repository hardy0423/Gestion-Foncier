import { Component, Inject, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators, FormBuilder } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { NotifierService } from 'angular-notifier';
import { catchError, EMPTY, filter, ReplaySubject, Subject, switchMap, takeUntil, tap } from 'rxjs';
import { ResultOfDigitalise } from 'src/app/data/models/layer-to-digitalise';
import { Layer } from 'src/app/data/models/type';
import { Feature as OlFeature, WFS } from "src/app/ol-module";
import { MapsService } from 'src/app/data/services/maps.service';
import { HttpErrorResponse } from '@angular/common/http';


export interface Columns {
  column: string,
  type: string
}

@Component({
  selector: 'app-update-multiple',
  templateUrl: './update-multiple.component.html',
  styleUrls: ['./update-multiple.component.scss']
})
export class UpdateMultipleComponent implements OnInit {

  form: FormGroup = this.formBuilder.group({});
  onUpdateInstance: () => void;

  private destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);

  constructor(
    public dialogRef: MatDialogRef<UpdateMultipleComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { columns: Columns[], layer: Layer, ids: number[] },
    private formBuilder: FormBuilder,
    public mapsService: MapsService,
    public translate: TranslateService,
    public notifierService: NotifierService,
    public dialog: MatDialog,) {

    this.form.addControl(
      "column",
      new FormControl('', [
        Validators.required,
      ])
    );

    this.form.addControl(
      "value",
      new FormControl('', [
        Validators.required,
      ])
    );

    const onUpdate: Subject<void> = new Subject<void>();
    this.onUpdateInstance = () => {
      onUpdate.next();
    };

    onUpdate
      .pipe(
        takeUntil(this.destroyed$),
        filter(() => this.form.valid),
        switchMap(() => {
          this.form.disable();
          let layer = this.data.layer;

          let data = {
            id: this.data.ids,
            field_name: this.form.get('column').value.column,
            value: this.form.get('value').value,
            table: layer.providers[0].vp.table,
            schema: layer.providers[0].vp.shema,
            layer_id: layer.layer_id,
          };

          let dataTransaction: ResultOfDigitalise = {
            updates: [],
            deletes: [],
            inserts: [],
          };

          data.id.forEach(id => {
            let updatedFeatures = new OlFeature()
            updatedFeatures.setId(id)
            updatedFeatures.setProperties(
              {
                [data.field_name]: (!data.value || data.value == '' || data.value == 'NULL') ? null : data.value
              }
            )
            dataTransaction.updates.push(updatedFeatures)
          });

          const transaction = mapsService.generateTransaction(
            dataTransaction.inserts,
            dataTransaction.updates,
            dataTransaction.deletes,
            layer.providers[0].vp.id_server
          )
          let query =
            "map=" +
            layer.providers[0].vp.path_qgis +
            "&SERVICE=WFS&VERSION=1.1.0&TYPENAME=" +
            layer.providers[0].vp.id_server;

          return this.mapsService.manageFeatures(query, {
            base_transaction: transaction
          }).pipe(
            catchError((error: HttpErrorResponse) => {
              this.form.enable();
              this.notifierService.notify(
                "error",
                error.error?.msg
                  ? error.error.msg
                  : this.translate.instant("map.edit.error_saving_layer")
              );
              return EMPTY;
            }), tap(() => {
              this.form.enable();
              this.dialogRef.close();
            })
          );


        }))

      .subscribe();

  }



  ngOnInit(): void {
  }


  close(): void {
    this.dialogRef.close(false);
  }

  ngOnDestroy(): void {
    this.destroyed$.next(true);
    this.destroyed$.complete();
  }

}
