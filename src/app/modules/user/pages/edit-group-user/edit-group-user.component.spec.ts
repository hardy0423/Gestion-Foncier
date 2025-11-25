import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditGroupUserComponent } from './edit-group-user.component';

describe('EditGroupUserComponent', () => {
  let component: EditGroupUserComponent;
  let fixture: ComponentFixture<EditGroupUserComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EditGroupUserComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditGroupUserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
