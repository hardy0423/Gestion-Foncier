import { SelectionModel } from "@angular/cdk/collections";
import { Component, OnInit, ViewChild } from "@angular/core";
import { FormBuilder, FormControl, FormGroup } from "@angular/forms";
import { MatDialog } from "@angular/material/dialog";
import { MatSort, Sort } from "@angular/material/sort";
import { ActivatedRoute, Router } from "@angular/router";
import { TranslateService } from "@ngx-translate/core";
import { NotifierService } from "angular-notifier";
import {
  catchError,
  debounceTime,
  EMPTY,
  filter,
  map,
  merge,
  Observable,
  ReplaySubject,
  Subject,
  switchMap,
  takeUntil,
  tap
} from "rxjs";
import { GroupUser, User } from "src/app/data/models/account";
import { GroupUserService } from "src/app/data/services/group-user.service";
import { MapsService } from "src/app/data/services/maps.service";
import { UserService } from "src/app/data/services/user.service";
import { StoreService } from "src/app/data/store/store.service";
import { ManageCompHelper } from "src/helper/manage-comp.helper";
import { AddUserComponent } from "../add-user/add-user.component";
import { ChooseGroupComponent } from "../choose-group/choose-group.component";
import { ListGroupUserComponent } from "../list-group-user/list-group-user.component";

@Component({
  selector: "app-list-user",
  templateUrl: "./list-user.component.html",
  styleUrls: ["./list-user.component.scss"],
})
export class ListUserComponent implements OnInit {
  /**
   * get the list user
   */
  public onInitInstance: () => void;

  /**
   * Emit to sort name user column
   */
  onSortChangeInstance: (e: Sort) => void;

  /**
   * Emit to add one user
   */
  public onAddUserInstance: () => void;

  /**
   * Emit to edit one user
   */
  public onEditUserInstance: (user: User) => void;

  /**
   * Emit to manage groups
   */
  public onManageGroupsInstance: () => void;

  public onAddUserGroupInstance: () => void;
  /**
   * user list of a map
   */
  users$: Observable<User[]>;
  
  /**
   * group list of a map
   */
  groups$: Observable<GroupUser[]>;

  public destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);

  displayedColumns: string[] = [
    "check",
    "last_name",
    "first_name",
    "email",
    "entreprise",
    "is_superuser",
    "group",
    "is_active"
  ];

  searchColumns: string[] = [
    "search_check",
    "search_last_name",
    "search_first_name",
    "search_email",
    "search_entreprise",
    "search_is_superuser",
    "search_group",
    "search_is_active",
  ];

  loading: boolean = true;

  loadingStart: boolean;

  showFilters: boolean = false

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

  searchForm: FormGroup;

  selection = new SelectionModel<User>(true, []);

  constructor(
    public formBuilder: FormBuilder,
    public manageCompHelper: ManageCompHelper,
    public notifierService: NotifierService,
    public translate: TranslateService,
    public userService: UserService,
    public mapsService: MapsService,
    public route: ActivatedRoute,
    public router: Router,
    public dialog: MatDialog,
    public store: StoreService,
    public groupService: GroupUserService
  ) {
    this.searchForm = this.formBuilder.group({
      check: new FormControl(null),
      last_name: new FormControl(""),
      first_name: new FormControl(""),
      email: new FormControl(""),
      entreprise: new FormControl(""),
      is_superuser: new FormControl(null),
      group: new FormControl(""),
      is_active: new FormControl(null),
    });

    this.loadingStart = true;

    const onInit: Subject<void> = new ReplaySubject<void>(1);
    this.onInitInstance = () => {
      onInit.next();
    };

    this.groups$ = onInit.pipe(
      switchMap(() => {
        return this.groupService.getAllGroupUsers().pipe(
          tap((groups) => {
            this.store.groupUsers$.next(groups)
            this.loadingStart = false;
          }),
          catchError((err) => {
            this.notifierService.notify(
              "error",
              "An error occured when loading groups"
            );
            this.loadingStart = false;
            return EMPTY;
          })
        )
      })
    )

    const onAddUser: Subject<void> = new Subject<void>();
    this.onAddUserInstance = () => {
      onAddUser.next();
    };

    const onEditUser: Subject<User> = new Subject<User>();
    this.onEditUserInstance = (user: User) => {
      onEditUser.next(user);
    };

    const onSortChange: Subject<Sort> = new Subject<Sort>();
    this.onSortChangeInstance = (e: Sort) => {
      onSortChange.next(e);
    };

    const onManageGroups: Subject<void> = new Subject<void>();
    this.onManageGroupsInstance = () => {
      onManageGroups.next();
    };

    const onAddUserGroup: Subject<void> = new Subject<void>();
    this.onAddUserGroupInstance = () => {
      onAddUserGroup.next();
    };

    this.users$ = merge(
      onSortChange,
      onAddUserGroup.pipe(
        switchMap(() => {
          this.dialog.closeAll();
          return this.dialog
            .open(ChooseGroupComponent, {
              disableClose: true,
              width: "35%",
              data: this.selection.selected.map((user) => user.id),
            })
            .afterClosed()
            .pipe(
              filter((response) => response),
              tap(() => {
                this.loading = true;
                this.selection.clear();
              })
            );
        })
      ),
      onAddUser.pipe(
        takeUntil(this.destroyed$),
        switchMap(() => {
          this.dialog.closeAll();
          return this.dialog
            .open(AddUserComponent, {
              data: null,
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
              width: "25vw",
              maxHeight: "100vh",
              height: "100vh",
            })
            .afterClosed()
            .pipe(
              filter((response) => response),
              tap(() => {
                this.loading = true;
              })
            );
        })
      ),
      onEditUser.pipe(
        filter((user) => user != undefined),
        switchMap((user) => {
          this.dialog.closeAll();
          return this.dialog
            .open(AddUserComponent, {
              data: user,
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
              width: "25vw",
              maxHeight: "100vh",
              height: "100vh",
            })
            .afterClosed()
            .pipe(
              filter((response) => response),
              tap(() => {
                this.loading = true;
              })
            );
        })
      ),

      onManageGroups.pipe(
        takeUntil(this.destroyed$),
        switchMap(() => {
          this.dialog.closeAll();
          return this.dialog
            .open(ListGroupUserComponent, {
              data: null,
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
              width: "25vw",
              maxHeight: "115vh",
              height: "115vh",
            })
            .afterClosed()
            .pipe(
              filter((response) => response),
              tap(() => {
                this.loading = true;
              })
            );
        })
      ),
      onInit,
      this.searchForm.valueChanges
    ).pipe(
      debounceTime(500),
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
        let field = sort.active ? sort.active : "created_at";
        let filter: string = "";
        this.displayedColumns.forEach((column) => {
          if (this.searchForm.get(column)?.value) {
            filter += "&"+column+"=" + this.searchForm.get(column).value;
          }
        })
        return this.userService
          .getSortedUsers("ordering=" + ordering + field + filter)
          .pipe(
            tap(() => {
              this.selection.clear()
              this.loading = false;
            }),
            catchError(() => {
              this.notifierService.notify(
                "error",
                this.translate.instant(
                  "users.manage_users_dialog.error_loading_users"
                )
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

  redirectEntreprise() {
    this.router.navigate(["/user/entreprises"]);
  }

    /** Whether the number of selected elements matches the total number of rows. */
    isAllSelected(users: User[]) {
      const numSelected = this.selection.selected.length;
      const numRows = users.length;
      return numSelected === numRows;
    }
  
    /** Selects all rows if they are not all selected; otherwise clear selection. */
    toggleAllRows(users: User[]) {
      if (this.isAllSelected(users)) {
        this.selection.clear();
        return;
      }
  
      this.selection.select(...users);
    }
  toogleShowFilters() {
    if (this.showFilters) {
      this.displayedColumns.forEach((column) => {
        this.searchForm.get(column)?.setValue('')
      })
    }
    this.showFilters = !this.showFilters
  }
}
