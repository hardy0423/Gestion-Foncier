import { Component, Inject, OnInit } from "@angular/core";
import {
  FormBuilder,
  FormControl,
  FormGroup,
  Validators,
} from "@angular/forms";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { TranslateService } from "@ngx-translate/core";
import { NotifierService } from "angular-notifier";
import { ReplaySubject, Observable, merge, EMPTY, of, Subject } from "rxjs";
import { catchError, filter, switchMap, takeUntil, tap } from "rxjs/operators";
import { GroupUser } from "src/app/data/models/account";
import { Layer } from "src/app/data/models/type";
import { MapsService } from "src/app/data/services/maps.service";
import { RightService } from "src/app/data/services/right.service";
import { environment } from "src/environments/environment";
import { ManageCompHelper } from "src/helper/manage-comp.helper";

@Component({
  selector: "app-search-layer",
  templateUrl: "./search-layer.component.html",
  styleUrls: ["./search-layer.component.scss"],
})
export class SearchLayerComponent implements OnInit {
  public env = environment;

  /**
   * Emit to add layers
   */
  onAddLayerInstance: () => void;

  /** search form */ form: FormGroup = this.formBuilder.group({});

  /** layers found on search */ searchResultLayer: Observable<Layer[]>;

  /** layers to save */ layers: Layer[] = [];


  public destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);

  /**
   * Constructor
   * @param mapService MapsService
   * @param notifierService NotifierService
   * @param translate TranslateService
   * @param formBuilder FormBuilder
   * @param manageCompHelper ManageCompHelper
   * @param rightService RightService
   * @param dialogRef MatDialogRef
   * @param data any
   */
  constructor(
    public mapService: MapsService,
    public notifierService: NotifierService,
    public translate: TranslateService,
    private formBuilder: FormBuilder,
    public manageCompHelper: ManageCompHelper,
    public rightService: RightService,
    public dialogRef: MatDialogRef<SearchLayerComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { group: GroupUser, for_read: boolean }
  ) {

    let searchControl = new FormControl(null, Validators.min(3));

    this.form.addControl("search_word", searchControl);

    this.searchResultLayer = searchControl.valueChanges.pipe(
      filter((value) => typeof value === "string" && value.length > 2),
      catchError((err) => of([])),
      switchMap((search_word: string) => {
        return this.mapService
          .searchLayer(search_word)
          .pipe(catchError(() => EMPTY));
      })
    );

    this.form.valueChanges.subscribe((newValue) => {
      if (newValue.search_word && typeof newValue.search_word == "object") {
        this.addSelectedLayers(newValue.search_word);
      }
    });

    const onAdd: Subject<void> = new ReplaySubject<void>();
    this.onAddLayerInstance = () => {
      onAdd.next();
    };

    onAdd
      .pipe(
        takeUntil(this.destroyed$),
        switchMap(() => {
          this.form.disable();
          let data = {
            group_layer_rights: [],
          };
          this.layers.forEach((element) => {
            let right: any = {
              group_id: this.data.group?.id,
              layer_id: element.layer_id,
            };
            if (this.data.for_read) {
              right.read = false;
              right.write = false;
            } else {
              right.write = true;
              right.read = true;
            }
            data.group_layer_rights.push(right);
          });

          return this.rightService.saveRight(data).pipe(
            catchError((error) => {
              this.form.enable();
              this.notifierService.notify(
                "error",
                this.translate.instant("user.error_manage_right")
              );
              return EMPTY;
            }),
            tap((_) => {
              this.form.enable();
              this.dialogRef.close(true);
            })
          );
        })
      )
      .subscribe();
  }

  ngOnInit(): void { }

  ngOnDestroy(): void {
    this.destroyed$.next(true);
    this.destroyed$.complete();
  }

  close(): void {
    this.dialogRef.close(false);
  }

  displaySelectedLayer(layer: Layer): string {
    return layer ? layer.name : "";
  }

  addSelectedLayers(layer: Layer) {
    let layerExisted = this.layers.filter((l) => l.layer_id == layer.layer_id);
    if (layerExisted.length == 0 || layerExisted == null) {
      this.layers.push(layer);
    }
  }

  onDelete(layer: Layer): void {
    const index = this.layers.indexOf(layer);

    if (index >= 0) {
      this.layers.splice(index, 1);
    }
  }
}
