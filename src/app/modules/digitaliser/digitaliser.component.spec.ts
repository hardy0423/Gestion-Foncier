import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DigitaliserComponent } from './digitaliser.component';

describe('DigitaliserComponent', () => {
  let component: DigitaliserComponent;
  let fixture: ComponentFixture<DigitaliserComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DigitaliserComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DigitaliserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
