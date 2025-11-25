import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UpdateJoinTableComponent } from './update-join-table.component';

describe('UpdateJoinTableComponent', () => {
  let component: UpdateJoinTableComponent;
  let fixture: ComponentFixture<UpdateJoinTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UpdateJoinTableComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UpdateJoinTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
