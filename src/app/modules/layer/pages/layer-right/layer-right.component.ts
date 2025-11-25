import { Component, Input, OnInit } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { TranslateService } from "@ngx-translate/core";
import { NotifierService } from "angular-notifier";
import {
  catchError,
  EMPTY,
  merge,
  Observable,
  ReplaySubject,
  Subject,
  switchMap,
  takeUntil,
} from "rxjs";
import { GroupsRight, GroupUser, User } from "src/app/data/models/account";
import { Layer } from "src/app/data/models/type";
import { RightService } from "src/app/data/services/right.service";
import { environment } from "src/environments/environment";
import { ManageCompHelper } from "src/helper/manage-comp.helper";
import { SearchUserComponent } from "../search-user/search-user.component";

@Component({
  selector: "app-layer-right",
  templateUrl: "./layer-right.component.html",
  styleUrls: ["./layer-right.component.scss"],
})
export class LayerRightComponent implements OnInit {
  @Input() layer: Layer;

  /**
   * get the list
   */
  public onInitInstance: () => void;

  /**
   * Emit delete read
   */
  onDeleteReadInstance: (group: GroupUser) => void;

  /**
   * Emit delete write
   */
  onDeleteWriteInstance: (group: GroupUser) => void;

  /**
   * Emit add right read
   */
  onAddReadInstance: () => void;

  /**
   * Emit add right write
   */
  onAddWriteInstance: () => void;

  /**
   * entreprise list of a map
   */
  groupRight$: Observable<GroupsRight>;

  public env = environment;

  public destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);

  /** type of right : read default = 1, write = 2 */
  typeRight = 1;

  loading: boolean = false;

  /**
   * Constructor
   * @param notifierService notifierService
   * @param translate translateService
   * @param dialog matdialog
   * @param manageCompHelper manageCompHelper
   * @param rightService rightService
   */
  constructor(
    public notifierService: NotifierService,
    public translate: TranslateService,
    public dialog: MatDialog,
    public manageCompHelper: ManageCompHelper,
    public rightService: RightService
  ) {
    const onInit: Subject<void> = new ReplaySubject<void>(1);
    this.onInitInstance = () => {
      onInit.next();
    };

    const onDeleteRead: Subject<GroupUser> = new Subject<GroupUser>();
    this.onDeleteReadInstance = (layer: GroupUser) => {
      onDeleteRead.next(layer);
    };

    const onDeleteWrite: Subject<GroupUser> = new Subject<GroupUser>();
    this.onDeleteWriteInstance = (layer: GroupUser) => {
      onDeleteWrite.next(layer);
    };

    const onAddRead: Subject<void> = new Subject<void>();
    this.onAddReadInstance = () => {
      onAddRead.next();
    };

    const onAddWrite: Subject<void> = new Subject<void>();
    this.onAddWriteInstance = () => {
      onAddWrite.next();
    };

    this.groupRight$ = onInit.pipe(
      takeUntil(this.destroyed$),
      switchMap(() => {
        return this.rightService.getGroupsByLayer(this.layer.layer_id).pipe(
          catchError(() => {
            this.notifierService.notify(
              "error",
              this.translate.instant("user.error_loading_right")
            );
            return EMPTY;
          })
        );
      })
    );

    this.groupRight$ = merge(
      onInit.pipe(
        switchMap(() => {
          return this.getRight();
        })
      ),
      onAddRead.pipe(
        switchMap(() => {
          const data = {
            layer: this.layer,
            for_read: true,
          };
          return this.dialog
            .open(SearchUserComponent, {
              disableClose: true,
              width: "30%",
              data: data,
            })
            .afterClosed()
            .pipe(
              switchMap(() => {
                return this.getRight();
              })
            );
        })
      ),
      onAddWrite.pipe(
        switchMap(() => {
          const data = {
            layer: this.layer,
            for_read: false,
          };
          return this.dialog
            .open(SearchUserComponent, {
              disableClose: true,
              width: "30%",
              data: data,
            })
            .afterClosed()
            .pipe(
              switchMap(() => {
                return this.getRight();
              })
            );
        })
      ),
      onDeleteRead.pipe(
        takeUntil(this.destroyed$),
        switchMap((group) => {
          this.loading = true;
          const data = {
            group_layer_rights: [
              {
                group_id: group.id,
                layer_id: this.layer.layer_id,
                read: true,
              },
            ],
          };
          return this.rightService.saveRight(data).pipe(
            catchError((error) => {
              this.loading = false;
              this.notifierService.notify(
                "error",
                this.translate.instant("user.error_manage_right")
              );
              return EMPTY;
            }),
            switchMap(() => {

              this.loading = false;
              return this.getRight();
            })
          );
        })
      ),
      onDeleteWrite.pipe(
        takeUntil(this.destroyed$),
        switchMap((group) => {
          this.loading = true;
          const data = {
            group_layer_rights: [
              {
                group_id: group.id,
                layer_id: this.layer.layer_id,
                write: false,
              },
            ],
          };
          return this.rightService.saveRight(data).pipe(
            catchError((error) => {
              this.loading = false;
              this.notifierService.notify(
                "error",
                this.translate.instant("user.error_manage_right")
              );
              return EMPTY;
            }),
            switchMap((data) => {
              this.loading = false;
              return this.getRight();
            })
          );
        })
      )
    );
  }

  ngOnInit(): void {
    this.onInitInstance();
  }

  getRight() {
    return this.rightService.getGroupsByLayer(this.layer.layer_id).pipe(
      catchError(() => {
        this.notifierService.notify(
          "error",
          this.translate.instant("user.error_loading_right")
        );
        return EMPTY;
      })
    );
  }

  ngOnDestroy(): void {
    this.destroyed$.next(true);
    this.destroyed$.complete();
  }

  read() {
    document.getElementById("two")?.classList.remove("activated");
    document.getElementById("one")?.classList.add("activated");
    document.getElementById("h")?.classList.remove("two");
    document.getElementById("h")?.classList.add("one");
    this.typeRight = 1;
  }

  write() {
    document.getElementById("one")?.classList.remove("activated");
    document.getElementById("two")?.classList.add("activated");
    document.getElementById("h")?.classList.add("one", "two");
    this.typeRight = 2;
  }
}
