import { Component, Inject, OnInit } from "@angular/core";
import { FormBuilder, FormControl, FormGroup, Validators } from "@angular/forms";
import {
  MatDialogRef,
  MatDialog,
  MAT_DIALOG_DATA,
} from "@angular/material/dialog";
import { TranslateService } from "@ngx-translate/core";
import { NotifierService } from "angular-notifier";
import { Layer, Map } from "src/app/data/models/type";
import { Subject, ReplaySubject, catchError, EMPTY, tap, Observable, filter, map, merge, of, switchMap, takeUntil } from "rxjs";
import { GroupUser, LayersRight, User } from "src/app/data/models/account";
import { GroupUserService } from "src/app/data/services/group-user.service";
import { MapsService } from "src/app/data/services/maps.service";
import { RightService } from "src/app/data/services/right.service";
import { environment } from "src/environments/environment";
import { ManageCompHelper } from "src/helper/manage-comp.helper";
import { SearchLayerComponent } from "../search-layer/search-layer.component";
import { MatSelectionListChange } from "@angular/material/list";

@Component({
  selector: "app-edit-group-user",
  templateUrl: "./edit-group-user.component.html",
  styleUrls: ["./edit-group-user.component.scss"],
})
export class EditGroupUserComponent implements OnInit {
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

  themes$:Observable<Map[]>

  public onInitInstance: () => void;
  onUpdateInstance: () => void;
  onDeleteInstance: () => void;

  /** type of right : read default = 1, write = 2 */
  typeRight = 1;

  loading : boolean = false;

  private destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);

  constructor(
    public dialogRef: MatDialogRef<EditGroupUserComponent>,
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

    this.form.addControl(
      "themes",
      new FormControl(this.group.map, [
        Validators.required,
      ])
    );

    this.mapsService
      .usersById({'ids':this.group.user_id } )
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

    const onInit: Subject<void> = new ReplaySubject<void>(1);
    this.onInitInstance = () => {
      onInit.next();
    };
    
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

    onUpdate
      .pipe(
        takeUntil(this.destroyed$),
        filter(() => this.form.valid),
        tap(() => {
          this.form.disable();
        }),
        switchMap(() => {
          let data = {
            name: this.form.get("name").value,
            action: "set",
            users: this.users.map(user => user.id),
            map_id:this.form.get('themes').value
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
              // this.form.reset();
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

    this.themes$ = onInit.pipe(
      switchMap(()=>{
        return this.mapsService.getAllMaps().pipe(
          catchError(() => {
            this.notifierService.notify(
              "error",
              "Impossible de lister les différents thèmes"
            );
            return EMPTY;
          }),
          tap((themes)=>{
            // this.form.get('themes').setValue(themes.map((theme=>theme.map_id)))
          })
        )
      })
    )
    this.layerRight$ = merge(
      onInit.pipe(
        switchMap(() => {
          return this.getRight();
        })
      ),

      onAddRead.pipe(
        switchMap(() => {
          const data = {
            group: this.group,
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
      onAddWrite.pipe(
        switchMap(() => {
          const data = {
            group: this.group,
            for_read: false,
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
      onDeleteRead.pipe(
        takeUntil(this.destroyed$),
        switchMap((layer) => {
          this.loading= true;
          const data = {
            group_layer_rights: [
              {
                group_id: this.group.id,
                layer_id: layer.layer_id,
                read: true,
              },
            ],
          };
          return this.rightService.saveRight(data).pipe(
            catchError((error) => {
              this.loading= false;
              this.notifierService.notify(
                "error",
                this.translate.instant("user.error_manage_right")
              );
              return EMPTY;
            }),
            switchMap(() => {
              this.loading= false;
              return this.getRight();
            })
          );
        })
      ),
      onDeleteWrite.pipe(
        takeUntil(this.destroyed$),
        switchMap((layer) => {
          this.loading= true;
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
              this.loading= false;
              this.notifierService.notify(
                "error",
                this.translate.instant("user.error_manage_right")
              );
              return EMPTY;
            }),
            switchMap((data) => {
              this.loading= false;
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

  themeSelectionChanged(chenges:MatSelectionListChange){
    
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

  ngOnDestroy(): void {
    this.destroyed$.next(true);
    this.destroyed$.complete();
  }
}
