--
-- PostgreSQL database dump
--

\restrict YRFORfc3gIJRKLugdNH4chZfXWUg0zt2OibS2V9oUUa4FRAKdWWtQjbHr1S7bpa

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

-- Started on 2026-05-26 00:58:28

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 226 (class 1259 OID 32769)
-- Name: appointments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.appointments (
    id integer NOT NULL,
    doctor_id integer,
    patient_id integer,
    booking_date character varying,
    token_number integer,
    created_at timestamp without time zone,
    status character varying DEFAULT 'pending'::character varying,
    patient_name_override character varying
);


ALTER TABLE public.appointments OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 32768)
-- Name: appointments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.appointments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.appointments_id_seq OWNER TO postgres;

--
-- TOC entry 5027 (class 0 OID 0)
-- Dependencies: 225
-- Name: appointments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.appointments_id_seq OWNED BY public.appointments.id;


--
-- TOC entry 224 (class 1259 OID 24582)
-- Name: doctor_patients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.doctor_patients (
    id integer NOT NULL,
    doctor_id integer,
    patient_id integer
);


ALTER TABLE public.doctor_patients OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 24581)
-- Name: doctor_patients_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.doctor_patients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.doctor_patients_id_seq OWNER TO postgres;

--
-- TOC entry 5028 (class 0 OID 0)
-- Dependencies: 223
-- Name: doctor_patients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.doctor_patients_id_seq OWNED BY public.doctor_patients.id;


--
-- TOC entry 222 (class 1259 OID 16403)
-- Name: predictions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.predictions (
    id integer NOT NULL,
    user_id integer,
    image_path character varying,
    result character varying,
    confidence double precision,
    created_at timestamp without time zone,
    doctor_id integer,
    all_scores character varying
);


ALTER TABLE public.predictions OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 16402)
-- Name: predictions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.predictions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.predictions_id_seq OWNER TO postgres;

--
-- TOC entry 5029 (class 0 OID 0)
-- Dependencies: 221
-- Name: predictions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.predictions_id_seq OWNED BY public.predictions.id;


--
-- TOC entry 228 (class 1259 OID 40961)
-- Name: registration_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.registration_requests (
    id integer NOT NULL,
    doctor_id integer,
    name character varying,
    phone character varying,
    cnic character varying,
    gender character varying,
    age integer,
    booking_date character varying,
    token_number integer,
    status character varying,
    rejection_reason character varying,
    created_at timestamp without time zone
);


ALTER TABLE public.registration_requests OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 40960)
-- Name: registration_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.registration_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.registration_requests_id_seq OWNER TO postgres;

--
-- TOC entry 5030 (class 0 OID 0)
-- Dependencies: 227
-- Name: registration_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.registration_requests_id_seq OWNED BY public.registration_requests.id;


--
-- TOC entry 220 (class 1259 OID 16390)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying,
    phone character varying,
    cnic character varying,
    hashed_password character varying,
    role character varying,
    profile_pic character varying,
    address character varying,
    specialization character varying,
    clinic_name character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    gender character varying(50),
    age integer,
    token_mode character varying DEFAULT 'fixed'::character varying,
    max_tokens integer DEFAULT 20,
    about text
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 16389)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- TOC entry 5031 (class 0 OID 0)
-- Dependencies: 219
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 4835 (class 2604 OID 32772)
-- Name: appointments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments ALTER COLUMN id SET DEFAULT nextval('public.appointments_id_seq'::regclass);


--
-- TOC entry 4834 (class 2604 OID 24585)
-- Name: doctor_patients id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctor_patients ALTER COLUMN id SET DEFAULT nextval('public.doctor_patients_id_seq'::regclass);


--
-- TOC entry 4833 (class 2604 OID 16406)
-- Name: predictions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.predictions ALTER COLUMN id SET DEFAULT nextval('public.predictions_id_seq'::regclass);


--
-- TOC entry 4837 (class 2604 OID 40964)
-- Name: registration_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registration_requests ALTER COLUMN id SET DEFAULT nextval('public.registration_requests_id_seq'::regclass);


--
-- TOC entry 4829 (class 2604 OID 16393)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 5019 (class 0 OID 32769)
-- Dependencies: 226
-- Data for Name: appointments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.appointments (id, doctor_id, patient_id, booking_date, token_number, created_at, status, patient_name_override) FROM stdin;
2	1	2	2026-05-18	1	2026-05-17 19:47:54.898024	completed	\N
3	1	1	2026-05-18	2	2026-05-17 20:22:52.090372	pending	\N
4	1	1	2026-05-20	1	2026-05-20 17:20:29.849015	completed	\N
8	1	1	2026-05-20	7	2026-05-20 17:22:34.950082	pending	\N
9	1	1	2026-05-20	9	2026-05-20 17:22:44.696187	pending	\N
5	1	1	2026-05-20	2	2026-05-20 17:20:35.69553	completed	\N
6	1	1	2026-05-20	3	2026-05-20 17:20:47.655018	completed	\N
10	1	1	2026-05-20	8	2026-05-20 17:32:43.169895	pending	\N
7	1	1	2026-05-20	4	2026-05-20 17:22:28.864288	completed	\N
11	1	1	2026-05-20	20	2026-05-20 18:37:52.852965	pending	\N
12	1	7	2026-05-25	1	2026-05-25 17:35:07.838299	pending	\N
13	7	8	2026-05-25	2	2026-05-25 18:17:58.808298	pending	Israr Hussain
\.


--
-- TOC entry 5017 (class 0 OID 24582)
-- Dependencies: 224
-- Data for Name: doctor_patients; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.doctor_patients (id, doctor_id, patient_id) FROM stdin;
1	1	2
2	1	1
4	1	5
5	1	6
6	7	8
\.


--
-- TOC entry 5015 (class 0 OID 16403)
-- Dependencies: 222
-- Data for Name: predictions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.predictions (id, user_id, image_path, result, confidence, created_at, doctor_id, all_scores) FROM stdin;
1	\N	uploads\\0f0b6063-8a1e-4da9-be7d-9ad0b91a3df9.png	TB	0.87	2026-05-02 19:04:07.080684	1	\N
2	\N	uploads\\b099a4eb-13b9-4e4a-9d9c-2dd2d2d98ea1.jpeg	Pneumonia	0.93	2026-05-02 20:22:37.511763	1	{"Normal": 0.33, "TB": 0.33, "Pneumonia": 0.33}
3	\N	uploads\\1ca7452b-18d0-4c00-a57e-d06b25c827b5.jpeg	TB	0.85	2026-05-02 20:25:56.503869	1	{"Normal": 0.33, "TB": 0.33, "Pneumonia": 0.33}
4	\N	uploads\\24e0a3ce-df43-41d2-9713-4f893908ec2c.png	Normal	0.91	2026-05-02 20:26:24.160889	1	{"Normal": 0.33, "TB": 0.33, "Pneumonia": 0.33}
5	\N	uploads\\684732a1-9efa-47b2-bfeb-d1fbaa6b3e33.png	Pneumonia	0.9153	2026-05-02 20:30:30.842512	1	{"Normal": 0.0644, "TB": 0.0203, "Pneumonia": 0.9153}
6	\N	uploads\\96749fb2-dfc5-4de6-b63b-0f51e09edaaa.png	Pneumonia	0.8773	2026-05-02 20:30:44.330185	1	{"Normal": 0.0357, "TB": 0.087, "Pneumonia": 0.8773}
7	\N	uploads\\44650f19-73e6-4e57-b353-ca4ec4071385.png	Normal	0.9501	2026-05-02 20:31:06.662146	1	{"Normal": 0.9501, "TB": 0.0122, "Pneumonia": 0.0377}
8	\N	uploads\\4e7f41e9-4dd5-4f13-8cf0-66f55ece2bef.png	Pneumonia	0.8623	2026-05-02 20:31:25.167299	1	{"Normal": 0.0667, "TB": 0.071, "Pneumonia": 0.8623}
9	\N	uploads\\71778da2-b881-4606-b90c-eebd9e3d2f9f.png	Pneumonia	0.8938	2026-05-02 20:31:38.540682	1	{"Normal": 0.0235, "TB": 0.0827, "Pneumonia": 0.8938}
10	\N	uploads\\d21df5d4-abc1-4072-a05e-27e2d4790a4b.png	Normal	0.8987	2026-05-02 20:31:49.6091	1	{"Normal": 0.8987, "TB": 0.0159, "Pneumonia": 0.0854}
11	\N	uploads\\aa6531c3-20d6-4996-a35a-6cdd0c8f4e16.png	TB	0.8753	2026-05-02 20:31:59.17145	1	{"Normal": 0.1039, "TB": 0.8753, "Pneumonia": 0.0208}
12	\N	uploads\\fc02b7e9-e51e-4d7c-9d8a-79ed38b6f4ae.png	Pneumonia	0.8921	2026-05-02 20:32:09.554999	1	{"Normal": 0.0796, "TB": 0.0283, "Pneumonia": 0.8921}
13	\N	uploads\\914508a3-9ee7-471a-b6c8-aa9748d1f95b.jpeg	Pneumonia	0.8792	2026-05-02 20:32:23.34633	1	{"Normal": 0.0156, "TB": 0.1052, "Pneumonia": 0.8792}
14	\N	uploads\\98ef7e5e-2049-4db7-8eea-3d7bc09607c0.jpeg	Normal	0.9163	2026-05-02 20:32:32.853937	1	{"Normal": 0.9163, "TB": 0.0484, "Pneumonia": 0.0353}
15	1	uploads\\1a5a22a4-3b15-4793-b62b-3b591e1e1839.jpeg	Pneumonia	0.861	2026-05-02 20:32:42.407741	1	{"Normal": 0.0124, "TB": 0.1266, "Pneumonia": 0.861}
16	\N	uploads\\8ecdc675-1181-4911-953d-ef8c20c2d419.png	Pneumonia	0.8984	2026-05-02 21:31:55.812129	1	{"Normal": 0.0496, "TB": 0.052, "Pneumonia": 0.8984}
17	\N	uploads\\f8f01070-8345-4326-b72d-34aa8fdc1157.png	Pneumonia	0.919	2026-05-02 21:35:14.893228	1	{"Normal": 0.0625, "TB": 0.0185, "Pneumonia": 0.919}
18	5	uploads\\d2a2740a-2364-4a44-8fb6-e19f8194f542.png	Normal	0.9542	2026-05-02 22:02:48.428741	1	{"Normal": 0.9542, "TB": 0.0227, "Pneumonia": 0.0231}
19	5	uploads\\efd51742-3c7e-4d88-82d5-6d1ddbd5a380.png	Normal	0.9513	2026-05-02 22:03:00.399057	1	{"Normal": 0.9513, "TB": 0.016, "Pneumonia": 0.0327}
20	5	uploads\\a4ec8e4e-24ff-4b53-901c-ad54e500bbe1.png	TB	0.9867	2026-05-02 22:03:15.083755	1	{"Normal": 0.004, "TB": 0.9867, "Pneumonia": 0.0093}
21	1	uploads\\23f404cb-828c-4734-95dc-d2f0b867ebf4.png	Pneumonia	0.926	2026-05-02 22:05:27.860353	1	{"Normal": 0.0517, "TB": 0.0223, "Pneumonia": 0.926}
22	6	uploads\\d4c71554-82b2-4541-bdcd-ffd4c99c18e1.png	Normal	0.8797	2026-05-17 17:56:01.508055	1	{"Normal": 0.8797, "TB": 0.0821, "Pneumonia": 0.0382}
23	6	uploads\\285997a5-980e-48b0-a4e2-b0b32e570783.png	Pneumonia	0.8549	2026-05-17 17:56:29.530126	1	{"Normal": 0.0487, "TB": 0.0964, "Pneumonia": 0.8549}
24	6	uploads\\865f0f5e-241c-4918-834f-8b3afba1945d.png	Normal	0.9742	2026-05-17 18:02:07.210119	1	{"Normal": 0.9742, "TB": 0.0132, "Pneumonia": 0.0126}
25	\N	uploads\\550ca4fc-2a59-40e6-b758-c616f52fc92e.png	TB	0.855	2026-05-17 18:03:13.545476	1	{"Normal": 0.0999, "TB": 0.855, "Pneumonia": 0.0451}
26	2	uploads\\21f64681-7463-4b4f-8fe9-7e03171d553a.png	Normal	0.8793	2026-05-17 19:39:27.564982	1	{"Normal": 0.8793, "TB": 0.057, "Pneumonia": 0.0637}
\.


--
-- TOC entry 5021 (class 0 OID 40961)
-- Dependencies: 228
-- Data for Name: registration_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.registration_requests (id, doctor_id, name, phone, cnic, gender, age, booking_date, token_number, status, rejection_reason, created_at) FROM stdin;
\.


--
-- TOC entry 5013 (class 0 OID 16390)
-- Dependencies: 220
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, name, phone, cnic, hashed_password, role, profile_pic, address, specialization, clinic_name, created_at, gender, age, token_mode, max_tokens, about) FROM stdin;
2	Patient	03481974607	156050413416	$2b$12$rUqBLOAM0DVYkxKld/Q5uO1LsA4/Z6olOyySeIV.NSOetdfMO2at2	patient	\N	\N	\N	\N	2026-05-03 02:51:30.402056	\N	\N	fixed	20	\N
4	Testing	1111111111	11111111111	$2b$12$sDpE8BH6pK3Dv/u3iarsNO.QgdNMfXQ9GYQOE8uzEXY4001oVOz4C	patient	\N	\N	\N	\N	2026-05-03 02:51:30.402056	\N	\N	fixed	20	\N
5	Mujib Khan	03481974608	22222222222222	$2b$12$aLbclJxiz0JiFcFpVv6jnecB/6MjYuodAbaLQPcFf4fQvgS/16zPG	patient	\N	Khwaza Khela\r\n5903	\N	\N	2026-05-02 21:57:39.585181	\N	\N	fixed	20	\N
6	Mujib Khan	034819746055	1234333333333	$2b$12$U07AOLqaN1qNW.aS.kUSGOT5T.bTDLXnGOmhM5wvKFvNuHXwgN3Um	patient	\N	Khwaza Khela\r\n5903	\N	\N	2026-05-17 17:27:17.92816	Male	22	fixed	20	\N
1	Mujib Ur Rahman	03481974606	1560504013415	$2b$12$Suk/dxPK9k2QkIlRSxNuH.Tln6/.3xphJwRRxfBt.Gg2JhY7Uf1P2	doctor	uploads/profiles/profile_c3a1db9e-14a1-4f1d-b6a2-f265fc93f7ee.ico	\N	\N	\N	2026-05-03 02:51:30.402056	\N	\N	fixed	20	\N
7	Akhtar Shah	03449857679	1560511111111	$2b$12$29obvTtGLR34HUmKrvo1OuC430f8D0dbITyrlsfjNALcjFOSGjVci	doctor	\N	\N	\N	\N	2026-05-25 17:31:43.141275	\N	\N	fixed	20	\N
8	Israr Hussain	03111111111	9999999999999	$2b$12$REKR7fAX27uBfQzC84E3VuXpRottIb7mV4sxdM5TuutAb8GxjP6Oa	patient	\N	Khwaza Khela 	\N	\N	2026-05-25 17:50:40.892064	Male	22	fixed	20	\N
\.


--
-- TOC entry 5032 (class 0 OID 0)
-- Dependencies: 225
-- Name: appointments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.appointments_id_seq', 13, true);


--
-- TOC entry 5033 (class 0 OID 0)
-- Dependencies: 223
-- Name: doctor_patients_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.doctor_patients_id_seq', 6, true);


--
-- TOC entry 5034 (class 0 OID 0)
-- Dependencies: 221
-- Name: predictions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.predictions_id_seq', 26, true);


--
-- TOC entry 5035 (class 0 OID 0)
-- Dependencies: 227
-- Name: registration_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.registration_requests_id_seq', 1, false);


--
-- TOC entry 5036 (class 0 OID 0)
-- Dependencies: 219
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 8, true);


--
-- TOC entry 4850 (class 2606 OID 32777)
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- TOC entry 4847 (class 2606 OID 24588)
-- Name: doctor_patients doctor_patients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctor_patients
    ADD CONSTRAINT doctor_patients_pkey PRIMARY KEY (id);


--
-- TOC entry 4845 (class 2606 OID 16411)
-- Name: predictions predictions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.predictions
    ADD CONSTRAINT predictions_pkey PRIMARY KEY (id);


--
-- TOC entry 4857 (class 2606 OID 40969)
-- Name: registration_requests registration_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registration_requests
    ADD CONSTRAINT registration_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 4842 (class 2606 OID 16398)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4851 (class 1259 OID 32788)
-- Name: ix_appointments_booking_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_appointments_booking_date ON public.appointments USING btree (booking_date);


--
-- TOC entry 4852 (class 1259 OID 32789)
-- Name: ix_appointments_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_appointments_id ON public.appointments USING btree (id);


--
-- TOC entry 4848 (class 1259 OID 24599)
-- Name: ix_doctor_patients_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_doctor_patients_id ON public.doctor_patients USING btree (id);


--
-- TOC entry 4843 (class 1259 OID 16417)
-- Name: ix_predictions_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_predictions_id ON public.predictions USING btree (id);


--
-- TOC entry 4853 (class 1259 OID 40976)
-- Name: ix_registration_requests_cnic; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_registration_requests_cnic ON public.registration_requests USING btree (cnic);


--
-- TOC entry 4854 (class 1259 OID 40975)
-- Name: ix_registration_requests_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_registration_requests_id ON public.registration_requests USING btree (id);


--
-- TOC entry 4855 (class 1259 OID 40977)
-- Name: ix_registration_requests_phone; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_registration_requests_phone ON public.registration_requests USING btree (phone);


--
-- TOC entry 4838 (class 1259 OID 16399)
-- Name: ix_users_cnic; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_users_cnic ON public.users USING btree (cnic);


--
-- TOC entry 4839 (class 1259 OID 16400)
-- Name: ix_users_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_users_id ON public.users USING btree (id);


--
-- TOC entry 4840 (class 1259 OID 16401)
-- Name: ix_users_phone; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_users_phone ON public.users USING btree (phone);


--
-- TOC entry 4862 (class 2606 OID 32778)
-- Name: appointments appointments_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id);


--
-- TOC entry 4863 (class 2606 OID 32783)
-- Name: appointments appointments_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.users(id);


--
-- TOC entry 4860 (class 2606 OID 24589)
-- Name: doctor_patients doctor_patients_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctor_patients
    ADD CONSTRAINT doctor_patients_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id);


--
-- TOC entry 4861 (class 2606 OID 24594)
-- Name: doctor_patients doctor_patients_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctor_patients
    ADD CONSTRAINT doctor_patients_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.users(id);


--
-- TOC entry 4858 (class 2606 OID 24576)
-- Name: predictions fk_doctor; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.predictions
    ADD CONSTRAINT fk_doctor FOREIGN KEY (doctor_id) REFERENCES public.users(id);


--
-- TOC entry 4859 (class 2606 OID 16412)
-- Name: predictions predictions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.predictions
    ADD CONSTRAINT predictions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 4864 (class 2606 OID 40970)
-- Name: registration_requests registration_requests_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registration_requests
    ADD CONSTRAINT registration_requests_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id);


-- Completed on 2026-05-26 00:58:28

--
-- PostgreSQL database dump complete
--

\unrestrict YRFORfc3gIJRKLugdNH4chZfXWUg0zt2OibS2V9oUUa4FRAKdWWtQjbHr1S7bpa

