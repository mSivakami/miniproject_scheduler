# Timetable Genetic Algorithm System — Structural Overview

---

## structures.py

### Teacher
**Variables**
- id: str  
- name: str  
- unavailable_slots: List[(day, period)]  
- _unavailable_set: Set[(day, period)]  

**Methods**
- __post_init__()  
- is_available(day, period) -> bool  

---

### Subject
**Variables**
- id: str  
- name: str  
- is_difficult: bool  
- is_lab: bool  
- priority: int  

---

### Room
**Variables**
- id: str  
- name: str  
- is_lab: bool  

---

### Class
**Variables**
- id: str  
- name: str  

---

### Break
**Variables**
- name: str  

---

### TimeSlot
**Variables**
- day: int  
- start_period: int  
- duration: int  

**Methods**
- get_periods() -> List[int]  
- bitmask(periods_per_day) -> int  
- copy() -> TimeSlot  

---

### LessonBlock
**Variables**
- id: str  
- teacher_id: str  
- subject_id: str  
- class_id: str  
- room_id: str  
- duration: int  
- is_locked: bool  
- locked_timeslot: Optional[TimeSlot]  

---

### Timetable
**Variables**
- days: int  
- periods_per_day: int  
- total_slots: int  
- breaks: Dict[(day,period), Break]  
- locked_lessons: List[LessonBlock]  
- assignments: Dict[lesson_id -> TimeSlot]  
- teacher_mask: Dict[teacher_id -> bitmask]  
- room_mask: Dict[room_id -> bitmask]  
- class_mask: Dict[class_id -> bitmask]  
- fitness: Optional[int]  

**Methods**
- _apply_mask(lesson, mask, add)  
- _init_locked()  
- get_assignment(lesson_id) -> TimeSlot  
- is_break(day, period) -> bool  
- can_assign(lesson, timeslot) -> bool  
- is_teacher_free(teacher_id, timeslot) -> bool  
- is_room_free(room_id, timeslot) -> bool  
- is_class_free(class_id, timeslot) -> bool  
- assign(lesson, timeslot)  

---

### LockedLessonConfig
**Variables**
- subject_id  
- subject_name  
- teacher_id  
- class_id  
- room_id  
- day  
- period  
- duration  
- description  

---

### LockedLessonBuilder
**Variables**
- _configs: List[LockedLessonConfig]  

**Methods**
- add_weekly_event(...)  
- add_class_event_for_all(...)  
- build_lesson_blocks(id_gen) -> List[LessonBlock]  
- get_locked_subjects() -> Dict[subject_id -> Subject]  
- print_summary()  

---

## constraints.py

### ConstraintChecker
**Variables**
- teachers  
- subjects  
- rooms  
- classes  
- lesson_blocks  
- difficult_subjects  
- lab_subjects  
- core_subjects  
- remedial_subjects  
- teacher_unavailable  

**Constants**
- HARD  
- SOFT  
- STRUCTURAL  

**Methods**
- calculate_fitness(tt) -> int  
- _compute_gaps_bitwise(class_slot, days, ppd) -> int  
- _sequence_penalties_bits(teacher_day_bits) -> (three, two)  

---

## genetic.py

### GeneticTimetableScheduler
**Variables**
- teachers  
- subjects  
- rooms  
- classes  
- lesson_blocks  
- days  
- periods_per_day  
- breaks  
- locked_lessons  
- free_lessons  
- sorted_free_lessons  
- checker: ConstraintChecker  
- population_size  
- generations  
- elite_size  
- tournament_size  
- base_mutation_rate  
- mutation_rate  
- _fitness_cache  

**Methods**
- _make_timetable() -> Timetable  
- _score(tt) -> int  
- _tournament(scored_population) -> Timetable  
- _crossover(parent1, parent2) -> Timetable  
- _mutate(tt)  
  - _move(tt)  
  - _swap(tt)  
- _adapt(stagnation)  
- evolve() -> (best_timetable, fitness_history)  

---

## printer.py

### print_timetable(...)

---

## pdf_generation.py

### generate_pdf_timetable(...)

---

## timetable_analyser.py

### TimetableAnalyzer
**Variables**
- tt  
- teachers  
- subjects  
- rooms  
- classes  
- lessons  
- checker  
- days  
- periods  
- day_names  

**Methods**
- build_slot_map()  
- hard_violations()  
- teacher_structure()  
- subject_structure()  
- gap_report()  
- full_diagnostic()  

---

## tt_cs.py

### create_comprehensive_test_case()
Returns:
- teachers  
- subjects  
- rooms  
- classes  
- lesson_blocks  