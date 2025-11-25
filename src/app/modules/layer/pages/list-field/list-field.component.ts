import { HttpErrorResponse } from "@angular/common/http";
import { Component, Input, OnInit } from "@angular/core";
import { EMPTY, ReplaySubject } from "rxjs";
import { catchError, filter, map, take, takeUntil, tap } from "rxjs/operators";
import { TranslateService } from "@ngx-translate/core";
import { NotifierService } from "angular-notifier";
import { FormArray, FormBuilder, FormGroup } from "@angular/forms";
import { CdkDragDrop, moveItemInArray } from "@angular/cdk/drag-drop";
import { CustomField, VectorProvider } from "src/app/data/models/type";
import { FieldService } from "src/app/data/services/field.service";
import { MatDialog } from "@angular/material/dialog";
import { SheetLayerComponent } from "../sheet-layer/sheet-layer.component";

@Component({
  selector: "app-list-field",
  templateUrl: "./list-field.component.html",
  styleUrls: ["./list-field.component.scss"],
})
export class ListFieldComponent implements OnInit {
  @Input() vectorProvider: VectorProvider;

  tableForm!: FormGroup;

  listFields: CustomField[] = [];

  toolTypes = [
    "pièce jointe",
    "case à cocher",
    "lien",
    "date/heure",
    "texte simple",
  ];

  loading: boolean = true;

  /** Fired when the component is destroyed */
  private destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);

  constructor(
    private formBuilder: FormBuilder,
    public translate: TranslateService,
    public notifierService: NotifierService,
    public dialog: MatDialog,
    public fieldService: FieldService
  ) {
    this.tableForm = this.formBuilder.group({
      Rows: this.formBuilder.array([]),
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  /**
   * form array
   */
  get formArr() {
    return this.tableForm.get("Rows") as FormArray;
  }

  /**
   * load data
   */
  loadData() {
    let query =
      "MAP=" +
      this.vectorProvider.path_qgis +
      "&SERVICE=WFS&VERSION=1.1.0&REQUEST=DescribeFeatureType&TYPENAME=" +
      this.vectorProvider.id_server;

    this.fieldService
      .getCustomFieldsOfVectorProvider(query)
      .pipe(
        tap(() => {
          this.loading = true;
        }),
        takeUntil(this.destroyed$),
        catchError((value: HttpErrorResponse) => {
          this.loading = false;
          if (value.status != 404) {
            this.notifierService.notify(
              "error",
              this.translate.instant(
                "layer.list_field.error_loading.custom_fields"
              )
            );
          }
          return EMPTY;
        }),
        tap((data: CustomField[]) => {
          this.loading = false;
          this.formatData(data)
        })
      )
      .subscribe();
  }

  /**
   * load form array
   */
  loadForm() {
    this.listFields = this.listFields.sort((a, b) => a.order - b.order);
    this.listFields.forEach((row) => {
      this.formArr.push(this.addRow(row));
    });
  }

  /**
   * add row
   * @param obj customField
   * @returns formBuilder
   */
  addRow(obj: CustomField) {
    return this.formBuilder.group({
      custom_field_id: [obj.custom_field_id],
      id_server: [obj.id_server],
      path_qgis: [obj.path_qgis],
      name_field: [obj.name_field],
      alias_fr: [obj.alias_fr],
      alias_de: [obj.alias_de],
      onglet: [obj.onglet],
      // alias: new FormControl(obj.alias, [Validators.required]),
      tooltip: [obj.tooltip],
      displayed: [obj.displayed],
      fieldtype: [obj.fieldtype],
      search: [obj.search],
      // tooltype: new FormControl(obj.tooltype, [Validators.required]),
      order: [obj.order],
    } );
  }

  /**
   * on destroy
   */
  ngOnDestroy(): void {
    this.destroyed$.next(true);
    this.destroyed$.complete();
  }

  /**
   * save the list
   */
  save() {
    this.tableForm.disable();
    this.loading = true;
    let values = [] as CustomField[];
    for (let i = 0; i < this.formArr.controls.length; i++) {
      let value = this.formArr.controls[i].value;
      value.alias_fr = value.alias_fr.trim();
      value.alias_de = value.alias_de.trim();
      value.order = i + 1;
      values.push(value);
    }

    let data = {
      custom_fields: values,
      provider_vector_id: this.vectorProvider.provider_vector_id,
    };

    this.fieldService
      .saveCustomFields(data)
      .pipe(
        takeUntil(this.destroyed$),
        catchError((value: HttpErrorResponse) => {
          this.tableForm.enable();
          this.loading = false;
          if (value.status != 404) {
            this.notifierService.notify(
              "error",
              this.translate.instant(
                "layer.list_field.error_loading.save_custom_fields"
              )
            );
          }
          return EMPTY;
        }),
        map((data: CustomField[]) => {
          this.notifierService.notify(
            "success",
            this.translate.instant("layer.list_field.message_save_success")
          );
          this.formatData(data)
          this.tableForm.enable();
          this.loading = false;
        })
      )
      .subscribe();
  }

  formatData(data: CustomField[]){
    this.tableForm = this.formBuilder.group({
      Rows: this.formBuilder.array([]),
    });
    this.listFields = data;
    this.loadForm();
  }
  /**
   * on drop tr
   * @param event
   */
  drop(event: CdkDragDrop<string[]> | any): void {
    moveItemInArray(
      this.formArr.controls,
      event.previousIndex,
      event.currentIndex
    );
  }

  /**
   * manage disposition fiche
   */
  manageTabField() {
    this.dialog
      .open(SheetLayerComponent, {
        disableClose: true,
        width: "90%",
        maxHeight:window.innerHeight - 60,
        data: {
          fields: this.listFields,
          provider_vector_id: this.vectorProvider.provider_vector_id,
        },
      })
      .afterClosed()
      .pipe(
        take(1),
        filter((loading:boolean)=>loading),
        tap(() => {
          this.loading = true;
          this.loadData();
        })
      ).subscribe()
  }
}
