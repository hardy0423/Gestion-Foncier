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
import { LayersRight, User } from "src/app/data/models/account";
import { RightService } from "src/app/data/services/right.service";
import { environment } from "src/environments/environment";
import { ManageCompHelper } from "src/helper/manage-comp.helper";
import { GroupUserService } from "src/app/data/services/group-user.service";
import { AddGroupUserComponent } from "../add-group-user/add-group-user.component";
import { EditGroupUserComponent } from "../edit-group-user/edit-group-user.component";

@Component({
  selector: "app-user-right",
  templateUrl: "./user-right.component.html",
  styleUrls: ["./user-right.component.scss"],
})
export class UserRightComponent implements OnInit {
  public env = environment;
  @Input() user: User;

  /**
   * get the list
   */
  public onInitInstance: () => void;

  /**
   * Emit edit group
   */
  onEditGroupInstance: (groupId: number) => void;

  /**
   *  list of layers no_read and write by user
   */
  layerRight$: Observable<LayersRight>;

  public destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);

  /** type of right : read default = 1, write = 2 */
  typeRight = 1;

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
    public groupService: GroupUserService,
    public dialog: MatDialog,
    public manageCompHelper: ManageCompHelper,
    public rightService: RightService
  ) {
    const onInit: Subject<void> = new ReplaySubject<void>(1);
    this.onInitInstance = () => {
      onInit.next();
    };

    const onEditGroup: Subject<number> = new Subject<number>();
    this.onEditGroupInstance = (groupId: number) => {
      onEditGroup.next(groupId);
    };

    this.layerRight$ = merge(
      onInit.pipe(
        switchMap(() => {
          return this.getRight();
        })
      ),
      onEditGroup.pipe(
        takeUntil(this.destroyed$),
        switchMap((groupId) => {
          // get group by id
          return this.groupService.getGroupUserById(groupId).pipe(
            catchError((error) => {
              this.notifierService.notify(
                "error",
                this.translate.instant("user.error_manage_right")
              );
              return EMPTY;
            }),
            switchMap((group) => {
              return this.dialog
                .open(EditGroupUserComponent, {
                  disableClose: true,
                  width: "35%",
                  data: group,
                })
                .afterClosed()
                .pipe(
                  switchMap(() => {
                    return this.getRight();
                  })
                );
            })
          );
        })
      )
    );
  }

  getRight() {
    if (this.user?.group_id) {
      return this.rightService.getLayersByGroup(this.user?.group_id).pipe(
        catchError(() => {
          this.notifierService.notify(
            "error",
            this.translate.instant("user.error_loading_right")
          );
          return EMPTY;
        })
      );
    } else {
      return [];
    }
  }

  ngOnInit(): void {
    this.onInitInstance();
  }

  ngOnDestroy(): void {
    this.destroyed$.next(true);
    this.destroyed$.complete();
  }

  checkRight(evt, typeRight) {
    let tablinks = document.getElementsByClassName("tablinks") as any;
    for (let i = 0; i < tablinks.length; i++) {
      tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    evt.currentTarget.className += " active";
    this.typeRight = typeRight;
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
