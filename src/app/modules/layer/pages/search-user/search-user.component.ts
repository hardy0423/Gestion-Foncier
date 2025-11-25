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
import {
  catchError,
  EMPTY,
  filter,
  Observable,
  of,
  ReplaySubject,
  Subject,
  switchMap,
  takeUntil,
  tap,
} from "rxjs";
import { GroupUser, User } from "src/app/data/models/account";
import { MapsService } from "src/app/data/services/maps.service";
import { RightService } from "src/app/data/services/right.service";
import { ManageCompHelper } from "src/helper/manage-comp.helper";

@Component({
  selector: "app-search-user",
  templateUrl: "./search-user.component.html",
  styleUrls: ["./search-user.component.scss"],
})
export class SearchUserComponent implements OnInit {
  /**
   * Emit to add users
   */
  onAddInstance: () => void;

  /** search form */ form: FormGroup = this.formBuilder.group({});

  /** groups found on search */ searchResultGroup: Observable<GroupUser[]>;

  /** groups to save */ groups: GroupUser[] = [];

  /** text on tooltip button */ textButton: string;

  public destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);

  loading: boolean = false;

  constructor(
    public mapsService: MapsService,
    public notifierService: NotifierService,
    public translate: TranslateService,
    private formBuilder: FormBuilder,
    public manageCompHelper: ManageCompHelper,
    public rightService: RightService,
    public dialogRef: MatDialogRef<SearchUserComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.textButton = this.data.for_read
      ? this.translate.instant("user.add_user_read_title") +
        this.translate.instant("of") +
        " "
      : this.translate.instant("user.add_user_write_title") +
        this.translate.instant("on") +
        " ";
    this.textButton += this.data.layer.name;

    let searchControl = new FormControl(null, Validators.min(3));

    this.form.addControl("search_word", searchControl);

    this.searchResultGroup = searchControl.valueChanges.pipe(
      filter((value) => typeof value === "string" && value.length > 2),
      catchError((err) => of([])),
      switchMap((search_word: string) => {
        return this.mapsService
          .searchGroups(search_word)
          .pipe(catchError(() => EMPTY));
      })
    );

    this.form.valueChanges.subscribe((newValue) => {
      if (newValue.search_word && typeof newValue.search_word == "object") {
        this.addSelectedUsers(newValue.search_word);
      }
    });

    const onAdd: Subject<void> = new ReplaySubject<void>();
    this.onAddInstance = () => {
      onAdd.next();
    };

    onAdd
      .pipe(
        takeUntil(this.destroyed$),
        switchMap(() => {
          this.loading = true;
          let data = {
            group_layer_rights: [],
          };
          this.groups.forEach((element) => {
            let right: any = {
              layer_id: this.data.layer.layer_id,
              group_id: element.id,
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
              this.loading = false;
              this.notifierService.notify(
                "error",
                this.translate.instant("user.error_manage_right")
              );
              return EMPTY;
            }),
            tap((_) => {
              this.loading = false;
              this.dialogRef.close(true);
            })
          );
        })
      )
      .subscribe();
  }

  ngOnInit(): void {}

  close(): void {
    this.dialogRef.close(false);
  }

  ngOnDestroy(): void {
    this.destroyed$.next(true);
    this.destroyed$.complete();
  }

  displaySelectedUser(user: User): string {
    return user
      ? user.first_name || user.last_name
        ? user.first_name + " " + user.last_name
        : user.username
      : "";
  }

  addSelectedUsers(group: GroupUser) {
    let userExisted = this.groups.filter((l) => l.id == group.id);
    if (userExisted.length == 0 || userExisted == null) {
      this.groups.push(group);
    }
  }

  onDelete(goup: GroupUser): void {
    const index = this.groups.indexOf(goup);
    if (index >= 0) {
      this.groups.splice(index, 1);
    }
  }
}
