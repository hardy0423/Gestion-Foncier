import {
  CdkDragDrop,
  moveItemInArray,
  transferArrayItem,
} from "@angular/cdk/drag-drop";
import { HttpErrorResponse } from "@angular/common/http";
import { Component, Inject, OnInit } from "@angular/core";
import {
  MatDialog,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from "@angular/material/dialog";
import { TranslateService } from "@ngx-translate/core";
import { NotifierService } from "angular-notifier";
import {
  catchError,
  EMPTY,
  filter,
  map,
  ReplaySubject,
  Subject,
  switchAll,
  switchMap,
  takeUntil,
  tap,
  Observable,
  merge,
  startWith,
  withLatestFrom,
  shareReplay,
  pairwise,
  take
} from "rxjs";
import { CustomField } from "src/app/data/models/type";
import { FieldService } from "src/app/data/services/field.service";
import { ConfirmationDialogComponent, ConfirmationDialogData } from "src/app/shared/pages/confirmation-dialog/confirmation-dialog.component";
import { AddTabComponent } from "../add-tab/add-tab.component";

export interface TabsField{
  onglet:string,
  old_name:string,
  fields: CustomField[]
}

@Component({
  selector: "app-sheet-layer",
  templateUrl: "./sheet-layer.component.html",
  styleUrls: ["./sheet-layer.component.scss"],
})
export class SheetLayerComponent implements OnInit {
  /**
   * Emit to add a tab
   */
  public onAddTabInstance: () => void;

  /**
   * Emit to edit a tab
   */
  public onEditTabInstance: (tab: string) => void;

  /**
   * Emit to remove a tab
   */
  public onRemoveTabInstance: (tab: TabsField) => void;

  /**
   * Emit save modifications
   */
   public onSaveInstance: () => void;


  public destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);

  tabsField$: Observable< TabsField[] >

  loading:boolean = false

  constructor(
    public dialog: MatDialog,
    public dialogRef: MatDialogRef<SheetLayerComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {fields: Array<CustomField>,provider_vector_id:number },
    public notifierService: NotifierService,
    public translate: TranslateService,
    public fieldService: FieldService
  ) {
   
    const onSave: Subject<void> = new Subject<void>();
    this.onSaveInstance = () => {
      onSave.next();
    };

    const onAdd: Subject<void> = new Subject<void>();
    this.onAddTabInstance = () => {
      onAdd.next();
    };

    const onEdit: Subject<string> = new Subject<string>();
    this.onEditTabInstance = (tab: string) => {
      onEdit.next(tab);
    };

    const onRemove: Subject<TabsField> = new Subject<TabsField>();
    this.onRemoveTabInstance = (tab: TabsField) => {
      onRemove.next(tab);
    };

    this.tabsField$ = merge(
      onAdd
      .pipe(
        switchMap(() => {
          let addTab = this.dialog
            .open(AddTabComponent, {
              disableClose: true,
              width: "30%",
              data: {
                onglet: null,
                update:false,
                all: Array.from(
                  new Set(this.data.fields.map((item: any) => item.onglet))
                ),
              },
            })

            addTab.afterOpened().pipe(
              take(1),
              withLatestFrom(this.tabsField$ ?this.tabsField$:EMPTY ),
              tap((e)=>{
                addTab.componentInstance.data.all = Array.from(
                  new Set(e[1].map((item: any) => item.onglet))
                )
              })
            ).subscribe()

            return addTab.afterClosed()
            .pipe(
              filter((response) => response),
              withLatestFrom(this.tabsField$ ?this.tabsField$:EMPTY ),
              map((parameters:[string,TabsField[]]) => {
                parameters[1].push({
                  onglet: parameters[0],
                  old_name: parameters[0],
                  fields: [],
                })
                return parameters[1]
              })
            );
        })
      ),
      onEdit
      .pipe(
        switchMap((onglet) => {
           
          let addTab = this.dialog
            .open(AddTabComponent, {
              disableClose: true,
              width: "30%",
              data: {
                onglet: onglet,
                update:true,
                all:[],
              },
            })
            
            addTab.afterOpened().pipe(
              take(1),
              withLatestFrom(this.tabsField$ ?this.tabsField$:EMPTY ),
              tap((e)=>{
                addTab.componentInstance.data.all = Array.from(
                  new Set(e[1].map((item: any) => item.onglet))
                )
              })
            ).subscribe()
            
            return addTab.afterClosed()
            .pipe(
              filter((response) => response),
              withLatestFrom(this.tabsField$ ?this.tabsField$:EMPTY ),
              map((parameters:[string,TabsField[]]) => {
                let tabsField = parameters[1]
                tabsField.filter((item) => item.onglet == onglet)
                  .forEach((element) => {
                    element.onglet = parameters[0];
                  });
                return tabsField
              })
            );
        })
      ),
      onRemove
      .pipe(
        switchMap((tabsFieldToRemove)=>{
          let data: ConfirmationDialogData = {
            confirmationTitle: this.translate.instant(
              "layer.list_field.delete_tab",
              {name:tabsFieldToRemove.onglet}
            ),
            confirmationExplanation: this.translate.instant(
              "layer.list_field.delete_tab_explain",
              {name:tabsFieldToRemove.onglet}
            ),
            cancelText: this.translate.instant("no"),
            confirmText: this.translate.instant("yes"),
            danger: true,
          };

          return this.dialog
            .open(ConfirmationDialogComponent, {
              data: data,
            })
            .afterClosed()
            .pipe(
              filter((value:boolean) => value),
              withLatestFrom(this.tabsField$ ?this.tabsField$:EMPTY ),
              tap((asd)=>{ console.log('zxccc') }),
              filter((parameters:[boolean,TabsField[]]) => { console.log(parameters[1]); return parameters[1].length > 1} ),
              map((parameters:[boolean,TabsField[]]) => {
                let tabsFields = parameters[1]
                let firstTaabsFieldAfterRemoved = tabsFields.filter((tf)=>tf.onglet != tabsFieldToRemove.onglet)[0]
      
                if (tabsFieldToRemove.fields && tabsFieldToRemove.fields.length > 0) {
                  firstTaabsFieldAfterRemoved.fields = firstTaabsFieldAfterRemoved.fields.concat(tabsFieldToRemove.fields)
                }
                return tabsFields.filter((tf)=>tf.onglet != tabsFieldToRemove.onglet)
              })
            )
        })
      )
    ).pipe(
      shareReplay(1),
      startWith(
        Array.from(
          new Set(this.data.fields.map((item: any) => item.onglet))
        ).map((onglet:string) => {
          return {
            onglet: onglet,
            old_name: onglet,
            fields: this.data.fields.filter((field)=>field.displayed).filter((field) => field.onglet == onglet),
          }
        })
      )
    )

    onSave.pipe(
      takeUntil(this.destroyed$),
      withLatestFrom(this.tabsField$ ?this.tabsField$:EMPTY ),
      map((parameters:[void,TabsField[]])=>{
        let tabsFields = parameters[1]

       let values =  tabsFields
        .filter((item) => item.fields && item.fields.length > 0)
        .map((element, onglet_order) => {
          return element.fields.map((fields, field_order) => {
            fields.onglet = element.onglet;
            fields.order = onglet_order+field_order;
            return fields
            // values.push(fields);
          });
        })
        .flat()
        return {
          custom_fields: values,
          provider_vector_id: this.data.provider_vector_id,
        }
      }),
      switchMap((data)=>{
        this.loading = true
        return this.fieldService
          .saveCustomFields(data)
          .pipe(
            takeUntil(this.destroyed$),
            catchError((value: HttpErrorResponse) => {
              this.loading = false
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
            tap(() => {
              this.loading = false
              this.dialogRef.close(true);
            })
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

  drop(event: CdkDragDrop<CustomField[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    }
  }

}
