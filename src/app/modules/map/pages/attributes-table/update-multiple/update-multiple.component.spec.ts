import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UpdateMultipleComponent } from './update-multiple.component';

describe('UpdateMultipleComponent', () => {
  let component: UpdateMultipleComponent;
  let fixture: ComponentFixture<UpdateMultipleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UpdateMultipleComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UpdateMultipleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
