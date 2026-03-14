-- ============================================================
-- SEED DATA — generated from tt_cs.py
-- ============================================================

-- TEACHERS
INSERT INTO teachers (id, name) VALUES ('T01', 'Jithin') ON CONFLICT (id) DO NOTHING;
INSERT INTO teachers (id, name) VALUES ('T02', 'Vipin') ON CONFLICT (id) DO NOTHING;
INSERT INTO teachers (id, name) VALUES ('T03', 'Soni') ON CONFLICT (id) DO NOTHING;
INSERT INTO teachers (id, name) VALUES ('T04', 'Anusree') ON CONFLICT (id) DO NOTHING;
INSERT INTO teachers (id, name) VALUES ('T05', 'Rajan') ON CONFLICT (id) DO NOTHING;
INSERT INTO teachers (id, name) VALUES ('T06', 'Rahmathulla') ON CONFLICT (id) DO NOTHING;
INSERT INTO teachers (id, name) VALUES ('T07', 'Bisna') ON CONFLICT (id) DO NOTHING;
INSERT INTO teachers (id, name) VALUES ('T08', 'Dilesh') ON CONFLICT (id) DO NOTHING;
INSERT INTO teachers (id, name) VALUES ('T09', 'Panchami') ON CONFLICT (id) DO NOTHING;
INSERT INTO teachers (id, name) VALUES ('T10', 'Minors Coordinator') ON CONFLICT (id) DO NOTHING;
INSERT INTO teachers (id, name) VALUES ('T11', 'Ezhudeen') ON CONFLICT (id) DO NOTHING;
INSERT INTO teachers (id, name) VALUES ('T12', 'Soumya') ON CONFLICT (id) DO NOTHING;
INSERT INTO teachers (id, name) VALUES ('T13', 'Shehin') ON CONFLICT (id) DO NOTHING;
INSERT INTO teachers (id, name) VALUES ('T14', 'Joby') ON CONFLICT (id) DO NOTHING;
INSERT INTO teachers (id, name) VALUES ('T15', 'George') ON CONFLICT (id) DO NOTHING;
INSERT INTO teachers (id, name) VALUES ('T16', 'Nitha') ON CONFLICT (id) DO NOTHING;
INSERT INTO teachers (id, name) VALUES ('T17', 'Ali-Akbar') ON CONFLICT (id) DO NOTHING;
INSERT INTO teachers (id, name) VALUES ('T18', 'Dhanusree') ON CONFLICT (id) DO NOTHING;

-- SUBJECTS
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S2_SCI', 'Science', FALSE, FALSE, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S2_PHY', 'Physics', TRUE, FALSE, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S2_WEB', 'Hardware and Web Systems', TRUE, FALSE, 3) ON CONFLICT (id) DO NOTHING;
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S2_CP', 'C Programming', TRUE, FALSE, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S2_DM', 'Discrete Mathematics', FALSE, FALSE, 5) ON CONFLICT (id) DO NOTHING;
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S2_IPR', 'Intellectual Property Rights', FALSE, FALSE, 6) ON CONFLICT (id) DO NOTHING;
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S2_IT', 'IT Workshop', FALSE, TRUE, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S4_MATH', 'Mathematics', FALSE, FALSE, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S4_DBMS', 'Database Management Systems', TRUE, FALSE, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S4_OS', 'Operating Systems', TRUE, FALSE, 3) ON CONFLICT (id) DO NOTHING;
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S4_COA', 'Computer Organization and Architecture', TRUE, FALSE, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S4_ELEC', 'Elective', FALSE, FALSE, 5) ON CONFLICT (id) DO NOTHING;
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S4_ETH', 'Ethics', FALSE, FALSE, 6) ON CONFLICT (id) DO NOTHING;
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S4_OSLAB', 'Operating Systems Lab', FALSE, TRUE, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S4_DBMSLAB', 'DBMS Lab', FALSE, TRUE, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S4_MINOR', 'Minor', FALSE, FALSE, 6) ON CONFLICT (id) DO NOTHING;
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S4_HONOURS', 'Honours', FALSE, FALSE, 6) ON CONFLICT (id) DO NOTHING;
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S6_CD', 'Compiler Design', TRUE, FALSE, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S6_AAD', 'Advanced Algorithms', TRUE, FALSE, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S6_CG', 'Computer Graphics', TRUE, FALSE, 3) ON CONFLICT (id) DO NOTHING;
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S6_ELEC1', 'Elective 1', FALSE, FALSE, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S6_IEFD', 'Industrial Economics and Financial Decisions', FALSE, FALSE, 5) ON CONFLICT (id) DO NOTHING;
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S6_CCW', 'Comprehensive Course Work', FALSE, FALSE, 6) ON CONFLICT (id) DO NOTHING;
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S6_NETLAB', 'Networking Lab', FALSE, TRUE, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S6_MINIP', 'Mini Project', FALSE, TRUE, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S6_MINOR', 'Minor', FALSE, FALSE, 6) ON CONFLICT (id) DO NOTHING;
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S6_HONOURS', 'Honours', FALSE, FALSE, 6) ON CONFLICT (id) DO NOTHING;
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S8_DC', 'Distributed Computing', TRUE, FALSE, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S8_ELEC3', 'Elective 3', FALSE, FALSE, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S8_ELEC4', 'Elective 4', FALSE, FALSE, 3) ON CONFLICT (id) DO NOTHING;
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S8_ELEC5', 'Elective 5', FALSE, FALSE, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S8_CCV', 'Comprehensive Viva', FALSE, FALSE, 5) ON CONFLICT (id) DO NOTHING;
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S8_PROJECT', 'Major Project', FALSE, TRUE, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO subjects (id, name, is_difficult, is_lab, priority) VALUES ('S8_HONOURS', 'Honours', FALSE, FALSE, 6) ON CONFLICT (id) DO NOTHING;

-- ROOMS
INSERT INTO rooms (id, name, is_lab) VALUES ('R_S2', 'Semester 2 Classroom', FALSE) ON CONFLICT (id) DO NOTHING;
INSERT INTO rooms (id, name, is_lab) VALUES ('R_S4', 'Semester 4 Classroom', FALSE) ON CONFLICT (id) DO NOTHING;
INSERT INTO rooms (id, name, is_lab) VALUES ('R_S6', 'Semester 6 Classroom', FALSE) ON CONFLICT (id) DO NOTHING;
INSERT INTO rooms (id, name, is_lab) VALUES ('R_S8', 'Semester 8 Classroom', FALSE) ON CONFLICT (id) DO NOTHING;
INSERT INTO rooms (id, name, is_lab) VALUES ('IT_LAB', 'IT Laboratory', TRUE) ON CONFLICT (id) DO NOTHING;
INSERT INTO rooms (id, name, is_lab) VALUES ('LAB1', 'Laboratory 1', TRUE) ON CONFLICT (id) DO NOTHING;
INSERT INTO rooms (id, name, is_lab) VALUES ('LAB2', 'Laboratory 2', TRUE) ON CONFLICT (id) DO NOTHING;

-- CLASSES
INSERT INTO classes (id, name) VALUES ('C_S2', 'Semester 2') ON CONFLICT (id) DO NOTHING;
INSERT INTO classes (id, name) VALUES ('C_S4', 'Semester 4') ON CONFLICT (id) DO NOTHING;
INSERT INTO classes (id, name) VALUES ('C_S6', 'Semester 6') ON CONFLICT (id) DO NOTHING;
INSERT INTO classes (id, name) VALUES ('C_S8', 'Semester 8') ON CONFLICT (id) DO NOTHING;

-- BREAKS
INSERT INTO breaks (day, period, name) VALUES (0, 3, 'Lunch') ON CONFLICT (day, period) DO NOTHING;
INSERT INTO breaks (day, period, name) VALUES (1, 3, 'Lunch') ON CONFLICT (day, period) DO NOTHING;
INSERT INTO breaks (day, period, name) VALUES (2, 3, 'Lunch') ON CONFLICT (day, period) DO NOTHING;
INSERT INTO breaks (day, period, name) VALUES (3, 3, 'Lunch') ON CONFLICT (day, period) DO NOTHING;
INSERT INTO breaks (day, period, name) VALUES (4, 4, 'Lunch') ON CONFLICT (day, period) DO NOTHING;

-- LESSON BLOCKS + RELATIONS
INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0001', 'S4_MINOR', 2, TRUE, 2, 5) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0001', 'T14') ON CONFLICT DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0001', 'T16') ON CONFLICT DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0001', 'T12') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0001', 'C_S4') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0001', 'R_S4') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0002', 'S6_MINOR', 2, TRUE, 4, 5) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0002', 'T10') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0002', 'C_S6') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0002', 'R_S6') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0003', 'S6_MINOR', 1, TRUE, 3, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0003', 'T10') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0003', 'C_S6') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0003', 'R_S6') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0004', 'S6_HONOURS', 1, TRUE, 4, 3) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0004', 'T14') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0004', 'C_S6') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0004', 'R_S6') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0005', 'S8_HONOURS', 3, TRUE, 1, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0005', 'T03') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0005', 'C_S8') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0005', 'R_S8') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0006', 'S2_SCI', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0006', 'T11') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0006', 'C_S2') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0006', 'R_S2') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0007', 'S2_SCI', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0007', 'T11') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0007', 'C_S2') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0007', 'R_S2') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0008', 'S2_SCI', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0008', 'T11') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0008', 'C_S2') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0008', 'R_S2') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0009', 'S2_PHY', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0009', 'T06') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0009', 'C_S2') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0009', 'R_S2') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0010', 'S2_PHY', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0010', 'T06') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0010', 'C_S2') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0010', 'R_S2') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0011', 'S2_PHY', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0011', 'T06') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0011', 'C_S2') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0011', 'R_S2') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0012', 'S2_WEB', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0012', 'T01') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0012', 'C_S2') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0012', 'R_S2') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0013', 'S2_WEB', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0013', 'T01') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0013', 'C_S2') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0013', 'R_S2') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0014', 'S2_WEB', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0014', 'T01') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0014', 'C_S2') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0014', 'R_S2') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0015', 'S2_CP', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0015', 'T02') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0015', 'C_S2') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0015', 'R_S2') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0016', 'S2_CP', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0016', 'T02') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0016', 'C_S2') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0016', 'R_S2') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0017', 'S2_CP', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0017', 'T02') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0017', 'C_S2') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0017', 'R_S2') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0018', 'S2_CP', 2, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0018', 'T02') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0018', 'C_S2') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0018', 'LAB1') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0019', 'S2_DM', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0019', 'T03') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0019', 'C_S2') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0019', 'R_S2') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0020', 'S2_DM', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0020', 'T03') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0020', 'C_S2') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0020', 'R_S2') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0021', 'S2_DM', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0021', 'T03') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0021', 'C_S2') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0021', 'R_S2') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0022', 'S2_DM', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0022', 'T03') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0022', 'C_S2') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0022', 'R_S2') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0023', 'S2_IPR', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0023', 'T04') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0023', 'C_S2') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0023', 'R_S2') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0024', 'S2_IPR', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0024', 'T04') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0024', 'C_S2') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0024', 'R_S2') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0025', 'S2_IPR', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0025', 'T04') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0025', 'C_S2') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0025', 'R_S2') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0026', 'S2_IT', 2, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0026', 'T05') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0026', 'C_S2') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0026', 'IT_LAB') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0027', 'S2_IT', 2, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0027', 'T05') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0027', 'C_S2') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0027', 'IT_LAB') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0028', 'S4_MATH', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0028', 'T02') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0028', 'C_S4') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0028', 'R_S4') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0029', 'S4_MATH', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0029', 'T02') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0029', 'C_S4') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0029', 'R_S4') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0030', 'S4_MATH', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0030', 'T02') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0030', 'C_S4') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0030', 'R_S4') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0031', 'S4_DBMS', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0031', 'T06') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0031', 'C_S4') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0031', 'R_S4') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0032', 'S4_DBMS', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0032', 'T06') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0032', 'C_S4') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0032', 'R_S4') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0033', 'S4_DBMS', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0033', 'T06') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0033', 'C_S4') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0033', 'R_S4') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0034', 'S4_DBMS', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0034', 'T06') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0034', 'C_S4') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0034', 'R_S4') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0035', 'S4_OS', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0035', 'T07') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0035', 'C_S4') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0035', 'R_S4') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0036', 'S4_OS', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0036', 'T07') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0036', 'C_S4') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0036', 'R_S4') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0037', 'S4_OS', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0037', 'T07') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0037', 'C_S4') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0037', 'R_S4') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0038', 'S4_OS', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0038', 'T07') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0038', 'C_S4') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0038', 'R_S4') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0039', 'S4_COA', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0039', 'T08') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0039', 'C_S4') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0039', 'R_S4') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0040', 'S4_COA', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0040', 'T08') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0040', 'C_S4') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0040', 'R_S4') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0041', 'S4_COA', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0041', 'T08') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0041', 'C_S4') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0041', 'R_S4') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0042', 'S4_COA', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0042', 'T08') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0042', 'C_S4') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0042', 'R_S4') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0043', 'S4_ELEC', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0043', 'T11') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0043', 'C_S4') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0043', 'R_S4') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0044', 'S4_ELEC', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0044', 'T11') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0044', 'C_S4') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0044', 'R_S4') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0045', 'S4_ELEC', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0045', 'T11') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0045', 'C_S4') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0045', 'R_S4') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0046', 'S4_ETH', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0046', 'T04') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0046', 'C_S4') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0046', 'R_S4') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0047', 'S4_ETH', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0047', 'T04') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0047', 'C_S4') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0047', 'R_S4') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0048', 'S4_OSLAB', 3, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0048', 'T08') ON CONFLICT DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0048', 'T09') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0048', 'C_S4') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0048', 'LAB1') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0048', 'LAB2') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0049', 'S4_DBMSLAB', 3, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0049', 'T11') ON CONFLICT DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0049', 'T16') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0049', 'C_S4') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0049', 'LAB1') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0049', 'LAB2') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0050', 'S6_CD', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0050', 'T12') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0050', 'C_S6') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0050', 'R_S6') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0051', 'S6_CD', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0051', 'T12') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0051', 'C_S6') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0051', 'R_S6') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0052', 'S6_CD', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0052', 'T12') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0052', 'C_S6') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0052', 'R_S6') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0053', 'S6_CD', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0053', 'T12') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0053', 'C_S6') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0053', 'R_S6') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0054', 'S6_AAD', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0054', 'T01') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0054', 'C_S6') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0054', 'R_S6') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0055', 'S6_AAD', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0055', 'T01') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0055', 'C_S6') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0055', 'R_S6') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0056', 'S6_AAD', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0056', 'T01') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0056', 'C_S6') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0056', 'R_S6') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0057', 'S6_AAD', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0057', 'T01') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0057', 'C_S6') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0057', 'R_S6') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0058', 'S6_CG', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0058', 'T13') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0058', 'C_S6') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0058', 'R_S6') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0059', 'S6_CG', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0059', 'T13') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0059', 'C_S6') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0059', 'R_S6') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0060', 'S6_CG', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0060', 'T13') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0060', 'C_S6') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0060', 'R_S6') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0061', 'S6_CG', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0061', 'T13') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0061', 'C_S6') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0061', 'R_S6') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0062', 'S6_ELEC1', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0062', 'T09') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0062', 'C_S6') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0062', 'R_S6') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0063', 'S6_ELEC1', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0063', 'T09') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0063', 'C_S6') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0063', 'R_S6') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0064', 'S6_ELEC1', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0064', 'T09') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0064', 'C_S6') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0064', 'R_S6') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0065', 'S6_IEFD', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0065', 'T18') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0065', 'C_S6') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0065', 'R_S6') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0066', 'S6_IEFD', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0066', 'T18') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0066', 'C_S6') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0066', 'R_S6') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0067', 'S6_IEFD', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0067', 'T18') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0067', 'C_S6') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0067', 'R_S6') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0068', 'S6_CCW', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0068', 'T04') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0068', 'C_S6') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0068', 'R_S6') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0069', 'S6_NETLAB', 3, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0069', 'T14') ON CONFLICT DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0069', 'T13') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0069', 'C_S6') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0069', 'LAB1') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0069', 'LAB2') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0070', 'S6_MINIP', 3, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0070', 'T15') ON CONFLICT DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0070', 'T07') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0070', 'C_S6') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0070', 'LAB1') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0071', 'S8_DC', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0071', 'T09') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0071', 'C_S8') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0071', 'R_S8') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0072', 'S8_DC', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0072', 'T09') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0072', 'C_S8') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0072', 'R_S8') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0073', 'S8_DC', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0073', 'T09') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0073', 'C_S8') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0073', 'R_S8') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0074', 'S8_ELEC3', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0074', 'T15') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0074', 'C_S8') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0074', 'R_S8') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0075', 'S8_ELEC3', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0075', 'T15') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0075', 'C_S8') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0075', 'R_S8') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0076', 'S8_ELEC3', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0076', 'T15') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0076', 'C_S8') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0076', 'R_S8') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0077', 'S8_ELEC4', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0077', 'T13') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0077', 'C_S8') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0077', 'R_S8') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0078', 'S8_ELEC4', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0078', 'T13') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0078', 'C_S8') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0078', 'R_S8') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0079', 'S8_ELEC4', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0079', 'T13') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0079', 'C_S8') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0079', 'R_S8') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0080', 'S8_ELEC5', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0080', 'T16') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0080', 'C_S8') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0080', 'R_S8') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0081', 'S8_ELEC5', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0081', 'T16') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0081', 'C_S8') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0081', 'R_S8') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0082', 'S8_ELEC5', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0082', 'T16') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0082', 'C_S8') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0082', 'R_S8') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0083', 'S8_CCV', 1, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0083', 'T03') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0083', 'C_S8') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0083', 'R_S8') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0084', 'S8_PROJECT', 3, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0084', 'T17') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0084', 'C_S8') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0084', 'LAB1') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0085', 'S8_PROJECT', 3, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0085', 'T17') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0085', 'C_S8') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0085', 'LAB2') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0086', 'S8_PROJECT', 2, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0086', 'T17') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0086', 'C_S8') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0086', 'LAB1') ON CONFLICT DO NOTHING;

INSERT INTO lesson_blocks (id, subject_id, duration, is_locked, locked_day, locked_start_period) VALUES ('L0087', 'S8_PROJECT', 2, FALSE, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO lesson_teachers (lesson_id, teacher_id) VALUES ('L0087', 'T17') ON CONFLICT DO NOTHING;
INSERT INTO lesson_classes (lesson_id, class_id) VALUES ('L0087', 'C_S8') ON CONFLICT DO NOTHING;
INSERT INTO lesson_rooms (lesson_id, room_id) VALUES ('L0087', 'LAB2') ON CONFLICT DO NOTHING;