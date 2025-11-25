import { Component, OnInit, ViewChild } from "@angular/core";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";
import { MatSort, Sort } from "@angular/material/sort";
import { TranslateService } from "@ngx-translate/core";
import { NotifierService } from "angular-notifier";
import {
  catchError,
  EMPTY,
  filter,
  map,
  merge,
  Observable,
  ReplaySubject,
  Subject,
  switchMap,
  takeUntil,
  tap,
} from "rxjs";
import { GroupUser } from "src/app/data/models/account";
import { GroupUserService } from "src/app/data/services/group-user.service";
import { StoreService } from "src/app/data/store/store.service";
import { ManageCompHelper } from "src/helper/manage-comp.helper";
import { AddGroupUserComponent } from "../add-group-user/add-group-user.component";
import { EditGroupUserComponent } from "../edit-group-user/edit-group-user.component";

@Component({
  selector: "app-list-group-user",
  templateUrl: "./list-group-user.component.html",
  styleUrls: ["./list-group-user.component.scss"],
})
export class ListGroupUserComponent implements OnInit {
  /**
   * get the list group
   */
  public onInitInstance: () => void;

  /**
   * Emit to sort name group column
   */
  onSortChangeInstance: (e: Sort) => void;

  /**
   * Emit to add one group
   */
  public onAddGroupUserInstance: () => void;

  /**
   * Emit to edit one group
   */
  public onEditGroupUserInstance: (group: GroupUser) => void;

  /**
   * group list of a map
   */
  groups$: Observable<GroupUser[]>;

  public destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);

  displayedColumns: string[] = ["name", "users_count"];

  loading: boolean = true;

  @ViewChild(MatSort) set sort(sort: MatSort) {
    if (sort) {
      sort.sortChange
        .pipe(
          takeUntil(this.destroyed$),
          tap((e: Sort) => {
            this.onSortChangeInstance(e);
          })
        )
        .subscribe();
    }
  }

  constructor(
    public manageCompHelper: ManageCompHelper,
    public notifierService: NotifierService,
    public translate: TranslateService,
    public groupService: GroupUserService,
    public dialog: MatDialog,
    public dialogRef: MatDialogRef<ListGroupUserComponent>,
    public store: StoreService
  ) {
    const onInit: Subject<void> = new ReplaySubject<void>(1);
    this.onInitInstance = () => {
      onInit.next();
    };

    const onAddGroupUser: Subject<void> = new Subject<void>();
    this.onAddGroupUserInstance = () => {
      onAddGroupUser.next();
    };

    const onEditGroupUser: Subject<GroupUser> = new Subject<GroupUser>();
    this.onEditGroupUserInstance = (group: GroupUser) => {
      onEditGroupUser.next(group);
    };

    const onSortChange: Subject<Sort> = new Subject<Sort>();
    this.onSortChangeInstance = (e: Sort) => {
      onSortChange.next(e);
    };

    this.groups$ = merge(
      onSortChange,
      onAddGroupUser.pipe(
        switchMap(() => {
          return this.dialog
            .open(AddGroupUserComponent, {
              disableClose: true,
              width: "35%",
            })
            .afterClosed()
            .pipe(
              filter((response) => response),
              tap(() => {
                this.loading = true;
              }),
              switchMap((groups) => {
                return this.groupService.getAllGroupUsers().pipe(
                  tap(() => {
                    this.loading = false;
                  }),
                  catchError((err) => {
                    this.notifierService.notify(
                      "error",
                      "An error occured when loading groups"
                    );
                    this.loading = false;
                    return EMPTY;
                  })
                );
              })
            );
        })
      ),

      onEditGroupUser.pipe(
        switchMap((group: GroupUser) => {
          return this.dialog
            .open(EditGroupUserComponent, {
              disableClose: true,
              width: "35%",
              data: group,
            })
            .afterClosed()
            .pipe(
              filter((result) => result),
              tap(() => {
                this.loading = true;
              }),
              switchMap(() => {
                return this.groupService.getAllGroupUsers().pipe(
                  tap(() => {
                    this.loading = false;
                  }),
                  catchError((err) => {
                    this.notifierService.notify(
                      "error",
                      "An error occured when loading groups"
                    );
                    this.loading = false;
                    return EMPTY;
                  })
                );
              })
            );
        })
      ),
      onInit
    ).pipe(
      map((parameters: void | Sort) => {
        if (parameters != undefined) {
          return parameters;
        }
        let sort: Sort = {
          active: "created_at",
          direction: "desc",
        };
        return sort;
      }),
      switchMap((sort: Sort) => {
        this.loading = true;
        let ordering = sort.direction == "asc" ? "" : "-";
        return this.groupService
          .getAllGroupUsers("ordering=" + ordering + sort.active)
          .pipe(
            tap((groups) => {
              this.store.groupUsers$.next(groups)
              this.loading = false;
            }),
            catchError(() => {
              this.notifierService.notify(
                "error",
                this.translate.instant("groups.error_loadings")
              );
              this.loading = false;
              return EMPTY;
            })
          );
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
