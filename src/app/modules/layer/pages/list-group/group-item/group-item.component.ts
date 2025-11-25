import { Component, Input, OnInit } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { ActivatedRoute, Router } from "@angular/router";
import { TranslateService } from "@ngx-translate/core";
import { NotifierService } from "angular-notifier";
import {
  catchError,
  EMPTY,
  filter,
  merge,
  Observable,
  ReplaySubject,
  Subject,
  switchMap,
  tap,
} from "rxjs";
import { Group, GroupWithLayers, Layer } from "src/app/data/models/type";
import { MapsService } from "src/app/data/services/maps.service";
import { StyleService } from "src/app/data/services/style.service";
import { StoreService } from "src/app/data/store/store.service";
import { environment } from "src/environments/environment";
import { ManageCompHelper } from "src/helper/manage-comp.helper";
import { AddGroupComponent } from "../../add-group/add-group.component";
import { AddLayerComponent } from "../../add-layer/add-layer.component";
import { ChangeGroupModalComponent } from "../change-group-modal/change-group-modal.component";

@Component({
  selector: "app-group-item",
  templateUrl: "./group-item.component.html",
  styleUrls: ["./group-item.component.scss"],
})
export class GroupItemComponent implements OnInit {
  @Input() profil: number;

  /**
   * get the list group
   */
  public onInitInstance: () => void;

  /**
   * Emit to add a group
   */
  public onAddGroupInstance: () => void;

  /**
   * Emit to edit a group
   */
  public onEditGroupInstance: (group: GroupWithLayers) => void;

  /**
   * Emit to delete a group
   */
  public onDeleteGroupInstance: (group: GroupWithLayers) => void;

  /**
   * Emit to add a layer
   */
  public onAddLayerInstance: (group: GroupWithLayers) => void;

  /**
   * Emit to open a layer
   */
  public onOpenLayerInstance: (layer: Layer) => void;

  /**
   * Emit to change layer's group
   */
  public onChangeGroupInstance: (layer: Layer, groups: Group[]) => void;

  /**
   * group list of a map
   */
  groups$: Observable<GroupWithLayers[]>;

  public destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);

  public env = environment;

  loading: boolean = true;
  private readonly notifier: NotifierService;

  expandedGroupId: number = null;

  constructor(
    public manageCompHelper: ManageCompHelper,
    public notifierService: NotifierService,
    public translate: TranslateService,
    public mapsService: MapsService,
    public route: ActivatedRoute,
    public router: Router,
    public dialog: MatDialog,
    public styleService: StyleService,
    public store: StoreService
  ) {
    this.notifier = notifierService;
    const onInit: Subject<void> = new ReplaySubject<void>(1);
    this.onInitInstance = () => {
      onInit.next();
    };

    const onAddGroup: Subject<void> = new Subject<void>();
    this.onAddGroupInstance = () => {
      onAddGroup.next();
    };

    const onEditGroup: Subject<GroupWithLayers> =
      new Subject<GroupWithLayers>();
    this.onEditGroupInstance = (group: GroupWithLayers) => {
      onEditGroup.next(group);
    };

    const onDeleteGroup: Subject<GroupWithLayers> =
      new Subject<GroupWithLayers>();
    this.onDeleteGroupInstance = (group: GroupWithLayers) => {
      onDeleteGroup.next(group);
    };

    const onAddLayer: Subject<GroupWithLayers> = new Subject<GroupWithLayers>();
    this.onAddLayerInstance = (group: GroupWithLayers) => {
      onAddLayer.next(group);
    };
    this.onOpenLayerInstance = (layer: Layer) => {
      this.store.openedLayerId$.next(layer.layer_id);
      this.router.navigate(["layers", layer.group, layer.layer_id]);
    };

    const onChangeGroup: Subject<[Layer, Group[]]> = new Subject<
      [Layer, Group[]]
    >();
    this.onChangeGroupInstance = (layer: Layer, groups: Group[]) => {
      onChangeGroup.next([layer, groups]);
    };

    this.groups$ = merge(
      this.route.queryParams.pipe(
        filter((params) => params["reload"]),
        switchMap((params) => {
          return this.getListGroup();
        })
      ),
      onInit.pipe(
        switchMap(() => {
          return this.getListGroup();
        })
      ),
      onAddGroup.pipe(
        switchMap(() => {
          this.dialog.closeAll();
          return this.dialog
            .open(AddGroupComponent, {
              disableClose: true,
              width: "30%",
              data: { profil: this.profil, group: null },
            })
            .afterClosed()
            .pipe(
              filter((response) => response),
              tap(() => {
                this.loading = true;
              }),
              switchMap(() => {
                return this.getListGroup();
              })
            );
        })
      ),
      onEditGroup.pipe(
        switchMap((group: GroupWithLayers) => {
          this.dialog.closeAll();
          return this.dialog
            .open(AddGroupComponent, {
              disableClose: true,
              width: "30%",
              data: { group: group, profil: this.profil },
            })
            .afterClosed()
            .pipe(
              filter((response) => response),
              tap(() => {
                this.loading = true;
              }),
              switchMap(() => {
                return this.getListGroup();
              })
            );
        })
      ),
      onDeleteGroup.pipe(
        switchMap((group: GroupWithLayers) => {
          return this.manageCompHelper
            .openConfirmationDialog([], {
              confirmationTitle: this.translate.instant("layer.delete_group"),
              confirmationExplanation:
                this.translate.instant("layer.delete_a_group") +
                group.name +
                " ?",
              cancelText: this.translate.instant("cancel"),
              confirmText: this.translate.instant("delete"),
              danger: true,
            })
            .pipe(
              filter((resultConfirmation) => resultConfirmation),
              tap(() => {
                this.loading = true;
              }),
              switchMap(() => {
                return this.mapsService.deleteGroup(group).pipe(
                  catchError(() => {
                    this.notifierService.notify(
                      "error",
                      this.translate.instant("layer.error_loading_group.delete")
                    );
                    return EMPTY;
                  }),
                  switchMap(() => {
                    return this.getListGroup();
                  })
                );
              })
            );
        })
      ),
      onAddLayer.pipe(
        filter((group) => group != undefined),
        switchMap((group) => {
          return this.dialog
            .open(AddLayerComponent, {
              data: group,
              panelClass: [
                "dialogWithNoPadding",
                "animate__animated",
                "animate__slideInRight",
              ],
              position: {
                top: "0px",
                bottom: "0px",
                right: "0px",
              },
              width: "30%",
              maxHeight: "100vh",
              height: "100vh",
            })
            .afterClosed()
            .pipe(
              filter((createdLayer) => createdLayer),
              tap(() => {
                this.loading = true;
              }),
              switchMap((createdLayer: Layer) => {
                return mapsService.getLayer(createdLayer.layer_id).pipe(
                  catchError(() => {
                    this.notifierService.notify(
                      "error",
                      this.translate.instant("layer.error_loading_layer")
                    );
                    this.loading = false;
                    return EMPTY;
                  }),
                  switchMap((layer: Layer) => {
                    return mapsService
                      .getGroupWithLayersByMap(this.profil)
                      .pipe(
                        tap(() => {
                          this.loading = false;
                          this.onOpenLayerInstance(layer);
                        }),
                        catchError(() => {
                          this.notifierService.notify(
                            "error",
                            this.translate.instant(
                              "layer.error_loading_group.list"
                            )
                          );
                          this.loading = false;
                          return EMPTY;
                        })
                      );
                  })
                );
              })
            );
        })
      ),

      onChangeGroup.pipe(
        switchMap(([layer, groups]) => {
          this.dialog.closeAll();
          return this.dialog
            .open(ChangeGroupModalComponent, {
              disableClose: true,
              width: "30%",
              data: {
                layer: layer,
                groups: groups,
              },
            })
            .afterClosed()
            .pipe(
              filter((response) => response),
              tap(() => {
                this.loading = true;
              }),
              switchMap(() => {
                return this.getListGroup();
              })
            );
        })
      )
    );
  }

  getListGroup() {
    return this.mapsService.getGroupWithLayersByMap(this.profil).pipe(
      tap(() => {
        this.loading = false;
      }),
      catchError(() => {
        this.notifierService.notify(
          "error",
          this.translate.instant("layer.error_loading_group.list")
        );
        this.loading = false;
        return EMPTY;
      })
    );
  }

  ngOnInit(): void {
    this.onInitInstance();
  }

  ngOnDestroy(): void {
    this.destroyed$.next(true);
    this.destroyed$.complete();
  }
}
