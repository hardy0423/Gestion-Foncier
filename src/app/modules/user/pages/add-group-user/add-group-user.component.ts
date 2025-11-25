import { Component, Inject, OnInit } from "@angular/core";
import {
  FormGroup,
  FormBuilder,
  FormControl,
  Validators,
} from "@angular/forms";
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
  merge,
  Observable,
  of,
  ReplaySubject,
  Subject,
  switchMap,
  takeUntil,
  tap,
} from "rxjs";
import { Layer } from "src/app/data/models/type";
import { GroupUser, LayersRight, User } from "src/app/data/models/account";
import { GroupUserService } from "src/app/data/services/group-user.service";
import { MapsService } from "src/app/data/services/maps.service";
import { ManageCompHelper } from "src/helper/manage-comp.helper";
import { RightService } from "src/app/data/services/right.service";
import { SearchLayerComponent } from "../search-layer/search-layer.component";
import { environment } from "src/environments/environment";

@Component({
  selector: "app-add-group-user",
  templateUrl: "./add-group-user.component.html",
  styleUrls: ["./add-group-user.component.scss"],
})
export class AddGroupUserComponent implements OnInit {
  public env = environment;

  form: FormGroup = this.formBuilder.group({});

  /** users found on search */ searchResultUser: Observable<User[]>;

  /** users to save */ users: User[] = [];

  /**
   * Emit delete read
   */
  onDeleteReadInstance: (layer: Layer) => void;

  /**
   * Emit delete write
   */
  onDeleteWriteInstance: (layer: Layer) => void;

  /**
   * Emit add right read
   */
  onAddReadInstance: () => void;

  /**
   * Emit add right write
   */
  onAddWriteInstance: () => void;

  /**
   *  list of layers no_read and write by user
   */
  layerRight$: Observable<LayersRight>;

  public onInitInstance: () => void;
  onAddInstance: () => void;
  onUpdateInstance: () => void;
  onDeleteInstance: () => void;

  /** type of right : read default = 1, write = 2 */
  typeRight = 1;

  private destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);

  constructor(
    public dialogRef: MatDialogRef<AddGroupUserComponent>,
    private formBuilder: FormBuilder,
    public notifierService: NotifierService,
    public manageCompHelper: ManageCompHelper,
    public groupService: GroupUserService,
    public mapsService: MapsService,
    public translate: TranslateService,
    public rightService: RightService,
    public dialog: MatDialog,
    @Inject(MAT_DIALOG_DATA) public group: GroupUser
  ) {
    const onInit: Subject<void> = new ReplaySubject<void>(1);
    this.onInitInstance = () => {
      onInit.next();
    };

    if (this.group?.user_id && this.group?.user_id.length > 0) {

      this.mapsService
        .usersById({'ids':this.group.user_id })
        .pipe(
          catchError(() => {
            this.notifierService.notify(
              "error",
              this.translate.instant("layer.error_loading_group.create")
            );
            return EMPTY;
          }),
          tap((users) => {
            this.users =
              users && users != undefined
                ? users.filter((item) => !item.is_superuser)
                : [];
          })
        )
        .subscribe();
    } else {
      this.users = [];
    }

    let searchControl = new FormControl(null, Validators.min(3));

    this.form.addControl(
      "name",
      new FormControl(this.group?.name ? this.group.name : null, [
        Validators.required,
      ])
    );
    this.form.addControl("search_word", searchControl);

    this.searchResultUser = searchControl.valueChanges.pipe(
      filter((value) => typeof value === "string" && value.length > 2),
      catchError((err) => of([])),
      switchMap((search_word: string) => {
        return this.mapsService.searchUsers(search_word).pipe(
          filter((values) => values && values != undefined),
          catchError(() => EMPTY),
          map((value): User[] => {
            return value.filter((user) => !user.is_superuser);
          })
        );
      })
    );

    this.form.valueChanges.subscribe((newValue) => {
      if (newValue.search_word && typeof newValue.search_word == "object") {
        this.addSelectedUsers(newValue.search_word);
      }
    });

    const onAdd: Subject<void> = new Subject<void>();
    this.onAddInstance = () => {
      onAdd.next();
    };

    const onUpdate: Subject<void> = new Subject<void>();
    this.onUpdateInstance = () => {
      onUpdate.next();
    };

    const onDelete: Subject<void> = new Subject<void>();
    this.onDeleteInstance = () => {
      onDelete.next();
    };

    const onDeleteRead: Subject<Layer> = new Subject<Layer>();
    this.onDeleteReadInstance = (layer: Layer) => {
      onDeleteRead.next(layer);
    };

    const onDeleteWrite: Subject<Layer> = new Subject<Layer>();
    this.onDeleteWriteInstance = (layer: Layer) => {
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

    onAdd
      .pipe(
        takeUntil(this.destroyed$),
        filter(() => this.form.valid),
        tap(() => {
          this.form.disable();
        }),
        switchMap(() => {
          let data: GroupUser = {
            name: this.form.get("name").value,
            action: "set",
            users: this.users.map(user => user.id)
          }

          return this.groupService.createGroupUser(data).pipe(
            catchError(() => {
              this.notifierService.notify(
                "error",
                this.translate.instant("layer.error_loading_group.create")
              );
              this.form.enable();
              return EMPTY;
            }),
            tap((_) => {
              this.form.enable();
              this.form.reset();
              this.dialogRef.close(true);
            })
          );
        })
      )
      .subscribe();

    onUpdate
      .pipe(
        takeUntil(this.destroyed$),
        filter(() => this.form.valid),
        tap(() => {
          this.form.disable();
        }),
        switchMap(() => {
          let data: GroupUser = {
            name: this.form.get("name").value,
            action: "set",
            users: this.users.map(user => user.id)
          }
          return this.groupService.editGroupUser(this.group.id, data).pipe(
            catchError(() => {
              this.notifierService.notify(
                "error",
                this.translate.instant("layer.error_loading_group.update")
              );
              this.form.enable();
              return EMPTY;
            }),
            tap((_) => {
              this.form.enable();
              this.form.reset();
              this.dialogRef.close(true);
            })
          );
        })
      )
      .subscribe();

    onDelete
      .pipe(
        takeUntil(this.destroyed$),
        switchMap(() => {
          return this.manageCompHelper
            .openConfirmationDialog([], {
              confirmationTitle: this.translate.instant("layer.delete_group"),
              confirmationExplanation:
                this.translate.instant("layer.delete_a_group") +
                this.group.name +
                " ?",
              cancelText: this.translate.instant("cancel"),
              confirmText: this.translate.instant("delete"),
              danger: true,
            })
            .pipe(
              filter((resultConfirmation) => resultConfirmation),
              switchMap(() => {
                return this.groupService.deleteGroupUser(this.group.id).pipe(
                  catchError(() => {
                    this.notifierService.notify(
                      "error",
                      this.translate.instant("layer.error_loading_group.delete")
                    );
                    return EMPTY;
                  }),
                  tap((_) => {
                    this.dialogRef.close(true);
                  })
                );
              })
            );
        })
      )
      .subscribe();

    this.layerRight$ = merge(
      onInit.pipe(
        switchMap(() => {
          return this.getRight();
        })
      ),

      onAddRead.pipe(
        switchMap(() => {
          const data = {
            // user: this.user,
            for_read: true,
          };
          return this.dialog
            .open(SearchLayerComponent, {
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
      // onAddWrite.pipe(
      //   switchMap(() => {
      //     const data = {
      //       user: this.user,
      //       for_read: false,
      //     };
      //     return this.dialog
      //       .open(SearchLayerComponent, {
      //         disableClose: true,
      //         width: "30%",
      //         data: data,
      //       })
      //       .afterClosed()
      //       .pipe(
      //         switchMap(() => {
      //           return this.getRight();
      //         })
      //       );
      //   })
      // ),
      // onDeleteRead.pipe(
      //   takeUntil(this.destroyed$),
      //   switchMap((layer) => {
      //     const data = {
      //       group_layer_rights: [
      //         {
      //           user_id: this.user.id,
      //           layer_id: layer.layer_id,
      //           read: true,
      //         },
      //       ],
      //     };
      //     return this.rightService.saveRight(data).pipe(
      //       catchError((error) => {
      //         this.notifierService.notify(
      //           "error",
      //           this.translate.instant("user.error_manage_right")
      //         );
      //         return EMPTY;
      //       }),
      //       switchMap(() => {
      //         return this.getRight();
      //       })
      //     );
      //   })
      // ),
      onDeleteWrite.pipe(
        takeUntil(this.destroyed$),
        switchMap((layer) => {
          const data = {
            group_layer_rights: [
              {
                group_id: this.group.id,
                layer_id: layer.layer_id,
                write: false,
              },
            ],
          };
          return this.rightService.saveRight(data).pipe(
            catchError((error) => {
              this.notifierService.notify(
                "error",
                this.translate.instant("user.error_manage_right")
              );
              return EMPTY;
            }),
            switchMap((data) => {
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

  close(): void {
    this.dialogRef.close(false);
  }

  addSelectedUsers(user: User) {
    let userExisted = this.users.filter((l) => l.id == user.id);
    if (userExisted.length == 0 || userExisted == null) {
      this.users.push(user);
    }
  }

  onDelete(user: User): void {
    const index = this.users.indexOf(user);
    if (index >= 0) {
      this.users.splice(index, 1);
    }
  }

  displaySelectedUser(user: User): string {
    return user
      ? user.first_name || user.last_name
        ? user.first_name + " " + user.last_name
        : user.username
      : "";
  }

  checkRight(evt, typeRight) {
    let tablinks = document.getElementsByClassName("tablinks") as any;
    for (let i = 0; i < tablinks.length; i++) {
      tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    evt.currentTarget.className += " active";
    this.typeRight = typeRight;
  }

  getRight() {
    if (this.group) {

      return this.rightService.getLayersByGroup(this.group.id).pipe(
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
