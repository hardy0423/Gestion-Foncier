import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChangeGroupModalComponent } from './change-group-modal.component';

describe('ChangeGroupModalComponent', () => {
  let component: ChangeGroupModalComponent;
  let fixture: ComponentFixture<ChangeGroupModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ChangeGroupModalComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChangeGroupModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
