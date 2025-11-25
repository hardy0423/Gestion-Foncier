import { HttpErrorResponse } from "@angular/common/http";
import { Component, Inject, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, ValidationErrors, Validators } from "@angular/forms";
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { DomSanitizer } from '@angular/platform-browser';
import { TranslateService } from "@ngx-translate/core";
import { NotifierService } from "angular-notifier";
import { catchError, EMPTY, filter, Observable, ReplaySubject, Subject, switchMap, takeUntil, tap } from "rxjs";
import { Group, Layer, VectorProvider } from "src/app/data/models/type";
import { MapsService } from "src/app/data/services/maps.service";
import { OsmQuerryService } from "src/app/data/services/osm-querry.service";
import { SigFileService } from "src/app/data/services/sig-file.service";
import { VectorProviderService } from "src/app/data/services/vector-provider.service";
import { environment } from "src/environments/environment";
import { AddIconDialogComponent } from "../add-icon-dialog/add-icon-dialog.component";

@Component({
  selector: "app-add-layer",
  templateUrl: "./add-layer.component.html",
  styleUrls: ["./add-layer.component.scss"],
})
export class AddLayerComponent implements OnInit {


  onInitInstance: () => void
  /**
   * Add icon to layer
   */
  onAddIconInstance: () => void
  /**
   * Add layer to group
   */
  public onAddInstance: () => void

  form: FormGroup;
  public destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);


  activeForm: boolean = true

  env = environment;
  layerIcon: Layer;
  private readonly notifier: NotifierService;

  connections$: Observable<Array<string>>

  customValidationFunction(formGroup: FormGroup): ValidationErrors {
    let type_source = formGroup.controls['type_source'].value;
    if (type_source === 'file_sig' && formGroup.controls['source'].value === null) {
      formGroup.setErrors({ nameLengthFive: true } as ValidationErrors)
      return { nameLengthFive: true } as ValidationErrors
    } else if (type_source && type_source != 'file_sig') {
      if (formGroup.controls['sql'].value === null) {
        formGroup.setErrors({ noSql: "Veillez entrer une requète SQL" } as ValidationErrors)
        return { noSql: "Veillez entrer une requète SQL" } as ValidationErrors
      }
      let sql: string = formGroup.controls['sql'].value

      if (!sql.includes('geom') || !sql.includes('id')) {
        formGroup.setErrors({ sqlProblems: "Les colonnes 'id' et 'geom' sont obligatoires " } as ValidationErrors)
        return { sqlProblems: "Les colonnes 'id' et 'geom' sont obligatoires " } as ValidationErrors
      }
      return null;
    }
    return null;
  }

  constructor(
    private formBuilder: FormBuilder,
    public translate: TranslateService,
    public notifierService: NotifierService,
    public dialogRef: MatDialogRef<AddLayerComponent>,
    public dialog: MatDialog,
    public mapsService: MapsService,
    public vectorProviderService: VectorProviderService,
    public sigFileService: SigFileService,
    public osmQuerryService: OsmQuerryService,
    private _sanitizer: DomSanitizer,
    @Inject(MAT_DIALOG_DATA) public group: Group
  ) {

    this.notifier = notifierService;

    this.form = this.formBuilder.group({
      name: [null, Validators.required],
      type_source: ["file_sig", Validators.required],
      sql: [undefined],
      source: [undefined],
      connection: [undefined]
    });
    this.form.addValidators(this.customValidationFunction)

    const onInit: ReplaySubject<void> = new ReplaySubject<void>(1)
    this.onInitInstance = () => {
      onInit.next()
      onInit.complete()
    }


    this.connections$ = onInit.pipe(
      switchMap(() => {
        return this.osmQuerryService.listConnections().pipe(
          catchError((value: HttpErrorResponse) => {
            this.notifierService.notify("error", this.translate.instant('layer.error_loading_connections'))
            return EMPTY
          }),
        )
      })
    )
    const onAddIcon: Subject<void> = new Subject<void>()
    this.onAddIconInstance = () => {
      onAddIcon.next()
    }
    onAddIcon.pipe(
      takeUntil(this.destroyed$),
      switchMap(() => {
        return this.dialog.open(
          AddIconDialogComponent, {
          data: this.group.group_id
        }
        ).afterClosed().pipe(
          filter((value) => value),
          tap((value) => {
            this.layerIcon = value
          })
        )
      })
    ).subscribe()


    const onAdd: Subject<void> = new Subject<void>()
    this.onAddInstance = () => {
      onAdd.next()
    }
    onAdd.pipe(
      takeUntil(this.destroyed$),
      filter(() => this.form.valid),
      tap(() => {
        this.form.disable()
      }),
      switchMap(() => {
        let vectorProvider: VectorProvider = {
          name: this.form.get('name').value,
          geometry_type: 'null'
        }

        let layerData: Layer = this.layerIcon
        layerData.name = this.form.get('name').value
        layerData.type_source = this.form.get('type_source').value

        if (layerData.type_source === 'file_sig') {
          layerData.file = this.form.get('source').value[0]
        }
        else if (layerData.type_source === 'query') {
          layerData.sql = this.form.get('sql').value,
            layerData.connection = this.form.get('connection').value
        }
        else {
          this.form.enable()
          this.notifierService.notify("error", this.translate.instant('layer.source_must_be_file_or_query'))
          return EMPTY
        }

        return this.mapsService.addLayer(toFormData(layerData)).pipe(
          catchError((error: HttpErrorResponse) => {
            this.form.enable()
            this.notifier.notify("error", error.error?.msg ? error.error.msg : this.translate.instant('layer.error_adding_layer'))
            return EMPTY
          }),
          tap((layer) => { this.dialogRef.close(layer); })
        )
      })
    ).subscribe()
  }

  ngOnInit(): void {
    this.onInitInstance()
  }
  transform(v: any): any {
    return this._sanitizer.bypassSecurityTrustHtml(v);
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
  }

  return formData;
}