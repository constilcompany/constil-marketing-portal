import json
import urllib.request

SUPABASE_URL = "https://avppbvsxayehguepyjkb.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2cHBidnN4YXllaGd1ZXB5amtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAzMzk2MiwiZXhwIjoyMDkyNjA5OTYyfQ.IjIDpaxklgfczNpmHlrKAThnGzlECeMwtv9QodFPwZk"
USER_ID = "47f3d024-2cd0-4dc9-b2ef-3a2301618667"

products_data = [
    {"ref": "PRD-585CE410", "name": "Paint the Deck", "description": "vamos faerk depois vemis dar depois vamos comprar", "price": 2000.00, "extra_info": None},
    {"ref": "PRD-D26BDD36", "name": "Ceiling Preparation", "description": "1. Preparation Protect floors...", "price": 0.00, "extra_info": None},
    # ... I will include the full list in the actual execution
]

# I'll read the full JSON from the user's message and process it
user_input_json = """
[
        {
            "id": "ccda8863-15b2-4e48-8b73-1778dd31ca58",
            "ref": "PRD-585CE410",
            "name": "Paint the Deck",
            "description": "vamos faerk depois vemis dar depois vamos comprar",
            "price": "2000.00",
            "extra_info": null
        },
        {
            "id": "a285d31b-9e50-4531-aa67-df5938a059d0",
            "ref": "PRD-D26BDD36",
            "name": "Ceiling Preparation",
            "description": "1. Preparation  Protect floors, cabinets, fixtures, and furniture with plastic and drop cloths.  Remove or cover light fixtures and vents where necessary.  Scrape loose paint and sand uneven areas.  Spot repair damaged areas with joint compound / drywall mud.  Sand patches smooth to blend with existing ceiling surface.  Clean surface to remove dust and grease.    2. Stain Treatment  Apply stain-blocking primer (oil or shellac-based) to areas showing water marks or discoloration to prevent bleed-through.",
            "price": "0.00",
            "extra_info": null
        },
        {
            "id": "16ccb5aa-01aa-44f8-b38e-eb18fe13ca80",
            "ref": "PRD-E835FB91",
            "name": "Paint the Ceiling",
            "description": "Painting  Apply 2 coats of flat ceiling paint to entire ceiling for uniform color and sheen.  Cut around edges and fixtures, then roll the field evenly.    5. Final Touch  Reinstall fixtures and remove protection.  Inspect for uniform finish and touch up as needed.",
            "price": "0.00",
            "extra_info": null
        },
        {
            "id": "5ae64063-55d9-458b-9c87-2bce74c06777",
            "ref": "PRD-6012F038",
            "name": "Ceilin Paint",
            "description": "Painting  Apply 2 coats of flat ceiling paint to entire ceiling for uniform color and sheen.  Cut around edges and fixtures, then roll the field evenly.    5. Final Touch  Reinstall fixtures and remove protection.  Inspect for uniform finish and touch up as needed.",
            "price": "0.00",
            "extra_info": null
        },
        {
            "id": "987c538f-77a5-4473-814b-9090f18291a5",
            "ref": "PRD-CB2645FC",
            "name": "Paint for the Ceiling",
            "description": "Sherwin William , Promar 200",
            "price": "200.00",
            "extra_info": null
        },
        {
            "id": "42fd4e47-cd38-4048-a388-6e9a084dbd46",
            "ref": "PRD-063EB604",
            "name": "Cost",
            "description": "Painting includes applying two coats of flat ceiling paint.",
            "price": "1500.00",
            "extra_info": "Painting includes applying two coats of flat ceiling paint."
        },
        {
            "id": "48b9bf95-e8f3-4fda-81dd-c33dff3a8aee",
            "ref": "PRD-D1091213",
            "name": "Introduction",
            "description": "The Bethel Stone LLC has been a leading brand in painting services In Portland Maine. Established in the year 2019 with the vision of making residential and commercial painting services easier and more convenient for homeowners and business owners. From the beginning, our promise has been that of certainty, aiming to reassure customers of our quality and expertise. We are proud to be a Lead Cerified company, We are proud to follow EPA regulation, HUD regulation and OSHA regulation. Bethel Stone is also proud to have 1000.0000 insurance for Auto, General Liability and worker Compensation We focus on providing you with an extraordinary experience. Whether that project is in a home or commercial property, what matters most is your complete satisfaction. Everything we do, our whole reputation, is about ensuring a successful project for you. All work to be performed in a workmanlike, professional manner. Failure of the paint/stain coverage for any reason will be remedied upon notice by the Client to Bethel. Bethel provides all equipment, supplies, paint and stain needed for the job. Bethel will provide evidence of Workman's Compensation Insurance in force for all workmen. Bethel will provide evidence of $ 1,000,000 of liability insurance in force for the job. This agreement shall be governed by the laws of the State of Maine.",
            "price": "0.00",
            "extra_info": null
        },
        {
            "id": "9d56c9e2-dde8-4f01-9939-1badde856b46",
            "ref": "PRD-D9B301D3",
            "name": "Interior Scope of work",
            "description": "We propose to paint the following areas of your home: Living room (walls, ceiling, and trim) Dining room (walls, ceiling, and trim) Kitchen (walls, ceiling, and trim) Three bedrooms (walls, ceiling, and trim) One bathrooms (walls, ceiling, and trim) One Small office( Walls, Ceiling and trim) 12 Doors",
            "price": "0.00",
            "extra_info": null
        },
        {
            "id": "5c4afcfe-d429-4a92-80a2-6c527a7c3d9d",
            "ref": "PRD-8DB94A86",
            "name": "Paint for the Project",
            "description": "We will Provide Sherwin William Paint for Walls, doors, trims and Ceiling. Doors and Trims we will use SW Emerald. Walls . we will use Cashmere , Ceiling we will use Promar Ceiling.",
            "price": "0.00",
            "extra_info": null
        },
        {
            "id": "67612a03-d761-49fc-8719-97bf6d5d5ea3",
            "ref": "PRD-A20E9D90",
            "name": "Pool Area Renovation Estimate",
            "description": "Project: Indoor Pool Area Painting & Carpet Removal Scope: Pool painting, wall painting, carpet removal, and floor coating",
            "price": "0.00",
            "extra_info": null
        },
        {
            "id": "f308e865-f809-46d6-913f-6f0e3ffb0260",
            "ref": "PRD-521F9A0B",
            "name": "Pool Interior Painting",
            "description": "Surface Area: 2,000 sq ft  Preparation  Drain pool  Pressure wash surface  Acid wash and neutralize  Surface repairs and crack filling  Masking surrounding areas  Application  Apply 2 coats commercial pool epoxy / chlorinated rubber coating",
            "price": "7000.00",
            "extra_info": null
        },
        {
            "id": "f9297216-da18-41ff-b963-a64654be8cef",
            "ref": "PRD-07E7C65E",
            "name": "Pool Room Wall Painting",
            "description": "Clean walls  Patch and repair  Prime where needed  Apply 2 coats moisture-resistant paint",
            "price": "0.00",
            "extra_info": null
        },
        {
            "id": "759d0bd1-9a59-4140-b7d8-c57fecef6274",
            "ref": "PRD-256A2E97",
            "name": "Carpet Removal Around Pool",
            "description": "Remove carpet  Remove adhesive  Disposal  Surface preparation",
            "price": "2000.00",
            "extra_info": null
        },
        {
            "id": "86b11aab-dc1a-40df-aef1-10dd0f727bde",
            "ref": "PRD-3F8D64C2",
            "name": "Pool Deck Floor Coating Epoxy Non Slip",
            "description": "Surface grinding  Epoxy primer  2 coats industrial epoxy  Anti-slip additive",
            "price": "6000.00",
            "extra_info": null
        },
        {
            "id": "c8cb71ff-fc8d-4bc5-8c4c-df0d4d7e6536",
            "ref": "PRD-58C25DAC",
            "name": "Demolition and  Disposal",
            "description": "Remove old floor tile, shower, toilet, debris hauling Labor demolition and disposal",
            "price": "2000.00",
            "extra_info": null
        },
        {
            "id": "6d528e39-217d-4990-bb13-59771151cb99",
            "ref": "PRD-4AC00094",
            "name": "Shower Replacement",
            "description": "New shower base  Waterproofing system  Tile or wall panels  Plumbing valve and fixtures  Glass door",
            "price": "7000.00",
            "extra_info": null
        },
        {
            "id": "694f449e-0c40-4a8a-8f3f-213df54f3fdc",
            "ref": "PRD-87182166",
            "name": "Tile Floor Installation",
            "description": "sq ft tile installati",
            "price": "6000.00",
            "extra_info": null
        },
        {
            "id": "effa1d18-e8ab-4482-b411-7b17a1427fa4",
            "ref": "PRD-F4C9C7D6",
            "name": "Toilet Replacement",
            "description": "",
            "price": "400.00",
            "extra_info": null
        },
        {
            "id": "fc94f87a-e8aa-4bf2-b57f-11fd90bfe753",
            "ref": "PRD-E2FF897E",
            "name": "Plumbing Adjustments",
            "description": "Small plumbing work for shower  toilet.",
            "price": "1200.00",
            "extra_info": null
        },
        {
            "id": "786fd835-bc4f-402f-87e2-a8fe28cf6d1d",
            "ref": "PRD-CCF8DA77",
            "name": "Exterior Softwashing",
            "description": "Protect landscaping, fixtures, and surrounding surfaces  Apply soft wash cleaning solution to exterior surfaces  Low-pressure wash siding, trim, soffits, fascia, and accessible exterior areas  Remove mildew, dirt, algae, cobwebs, and loose surface contaminants  Final rinse and allow surfaces to dry completely before painting",
            "price": "0.00",
            "extra_info": null
        },
        {
            "id": "58d54ec5-36d0-4377-ab42-cbe40005d568",
            "ref": "PRD-19965938",
            "name": "Exterior Painting Prep Work",
            "description": "Scraping & Surface Repair  Scrape all loose, peeling, or failing paint  Sand rough edges to create a smooth transition  Minor surface repairs (wood filler, patching small imperfections)  Caulking & Sealing  Caulk all gaps, joints, seams, windows, doors, and trim as needed  Seal cracks to prevent moisture intrusion  Priming  Spot prime all bare wood, patched areas, and exposed surfaces  Use appropriate primer for wood, siding, or previously painted surfaces",
            "price": "0.00",
            "extra_info": null
        },
        {
            "id": "ad3aa342-7bc9-4218-a6af-176659867766",
            "ref": "PRD-EA128D71",
            "name": "Scope of Work  Exterior Carpentry",
            "description": "Scope of Work – Exterior Carpentry (Pre-Paint Repairs) Perform necessary carpentry repairs to restore and prepare exterior surfaces prior to painting. All damaged or deteriorated materials will be addressed to ensure a solid, paint-ready substrate.  Included Work:  Inspection & Identification  Inspect siding, trim, fascia, soffits, and exterior wood components  Identify rot, water damage, cracks, and structural deterioration  Wood Replacement & Repairs  Remove and replace rotted or damaged wood (trim, fascia, rake boards, siding, etc.)  Repair minor wood damage using exterior-grade fillers or epoxy systems  Re-secure loose boards and components  Trim & Detail Work  Repair or replace window and door trim as needed  Ensure proper alignment and fastening of all exterior elements  Sealing & Preparation  Sand repaired areas for smooth finish  Prime all new and repaired wood surfaces  Ensure all carpentry work is paint-ready",
            "price": "0.00",
            "extra_info": null
        },
        {
            "id": "c59a3930-1857-4d31-ba68-0504ce6a0897",
            "ref": "PRD-4D1C750A",
            "name": "Paint Painting Process",
            "description": "Apply a high-quality exterior paint system using a combination of spray and roller methods to achieve full coverage and a uniform finish.  Included Work:  Apply two (2) full coats of exterior paint to all designated surfaces  Driveway-facing areas and detailed sections will be rolled to ensure proper penetration and even coverage  Main siding and large surface areas will be spray applied for efficiency and a smooth, consistent finish  Back-roll sprayed surfaces as needed to enhance adhesion and uniformity  Maintain clean lines and consistent coverage throughout all surfaces  Application Method:  Spray Application: Used for siding and large areas for smooth finish  Roll Application: Used on driveway-facing sections and areas requiring heavier coverage or texture consistency",
            "price": "0.00",
            "extra_info": null
        },
        {
            "id": "d4035de5-85f4-47ef-9569-0d55b7277308",
            "ref": "PRD-48444E9F",
            "name": "Scope of Lead Safe Procedures",
            "description": "Scope of Lead-Safe Procedures:  Containment & Protection  Install plastic sheeting to contain work areas and prevent dust spread  Protect landscaping, walkways, and surrounding property  Post required lead warning signage  Dust Minimization  Use wet methods when scraping or disturbing painted surfaces  Avoid prohibited practices (open flame burning, high-heat guns, uncontained sanding)  Utilize tools equipped with HEPA filtration  Worker Safety  Crew will wear appropriate PPE (respirators, gloves, protective clothing)  Certified personnel will supervise all lead-related work  Cleaning & Disposal  Daily cleanup of work areas  Thorough final cleaning using HEPA vacuum and wet wiping methods  Proper disposal of all contaminated materials in accordance with regulations",
            "price": "0.00",
            "extra_info": null
        },
        {
            "id": "ab3ea602-ed46-41d5-af24-4407de1bcf96",
            "ref": "PRD-A2D7C4EF",
            "name": "Interior Painting Process",
            "description": "Paint application follows industry-standard practices with proper surface preparation, primer application where required, and two-coat finish systems. Wall painting at $1.45 per square foot labor cost includes cutting-in, rolling, and brush work for uniform coverage. Ceiling painting utilizes specialized techniques and equipment for overhead application, maintaining consistent mil thickness and avoiding lap marks. Door and frame painting requires detailed brush work and careful masking to achieve clean lines and professional appearance. Window frame painting involves precise cutting-in around glazing and hardware, ensuring complete coverage while maintaining clean sight lines.",
            "price": "0.00",
            "extra_info": null
        },
        {
            "id": "312d0dac-1660-4bf1-b6f4-3da2ac194c7e",
            "ref": "PRD-03B4C386",
            "name": "Interior Painting Prep Work",
            "description": "All surfaces receive appropriate preparation including cleaning, patching of nail holes and minor imperfections, light sanding of glossy surfaces, and dust removal prior to paint application. Previously painted surfaces are evaluated for adhesion and compatibility with new coating systems. New drywall surfaces receive proper priming to ensure uniform paint absorption and appearance. Wood surfaces including door frames and window trim receive appropriate primer systems to prevent bleed-through and ensure proper topcoat adhesion. All preparation work is included in the labor rates ranging from $1.45 per square foot for standard surfaces.",
            "price": "0.00",
            "extra_info": null
        },
        {
            "id": "a99c7ba9-d813-4ca0-9277-9726b1619336",
            "ref": "PRD-293E1B78",
            "name": "Paint the Garage Door",
            "description": "Gel stain (mahogany tone)  Base coat (tan/light brown)  Clear protective topcoat (UV resistant)  Brushes / pads / tape",
            "price": "1000.00",
            "extra_info": null
        },
        {
            "id": "fc94f87a-e8aa-4bf2-b57f-11fd90bfe753",
            "ref": "PRD-E2FF897E",
            "name": "Plumbing Adjustments",
            "description": "Small plumbing work for shower  toilet.",
            "price": "1200.00",
            "extra_info": null
        },
        {
            "id": "effa1d18-e8ab-4482-b411-7b17a1427fa4",
            "ref": "PRD-F4C9C7D6",
            "name": "Toilet Replacement",
            "description": "",
            "price": "400.00",
            "extra_info": null
        },
        {
            "id": "694f449e-0c40-4a8a-8f3f-213df54f3fdc",
            "ref": "PRD-87182166",
            "name": "Tile Floor Installation",
            "description": "sq ft tile installati",
            "price": "6000.00",
            "extra_info": null
        },
        {
            "id": "6d528e39-217d-4990-bb13-59771151cb99",
            "ref": "PRD-4AC00094",
            "name": "Shower Replacement",
            "description": "New shower base  Waterproofing system  Tile or wall panels  Plumbing valve and fixtures  Glass door",
            "price": "7000.00",
            "extra_info": null
        },
        {
            "id": "c8cb71ff-fc8d-4bc5-8c4c-df0d4d7e6536",
            "ref": "PRD-58C25DAC",
            "name": "Demolition and  Disposal",
            "description": "Remove old floor tile, shower, toilet, debris hauling Labor demolition and disposal",
            "price": "2000.00",
            "extra_info": null
        },
        {
            "id": "759d0bd1-9a59-4140-b7d8-c57fecef6274",
            "ref": "PRD-256A2E97",
            "name": "Carpet Removal Around Pool",
            "description": "Remove carpet  Remove adhesive  Disposal  Surface preparation",
            "price": "2000.00",
            "extra_info": null
        },
        {
            "id": "ab3ea602-ed46-41d5-af24-4407de1bcf96",
            "ref": "PRD-A2D7C4EF",
            "name": "Interior Painting Process",
            "description": "Paint application follows industry-standard practices with proper surface preparation, primer application where required, and two-coat finish systems. Wall painting at $1.45 per square foot labor cost includes cutting-in, rolling, and brush work for uniform coverage. Ceiling painting utilizes specialized techniques and equipment for overhead application, maintaining consistent mil thickness and avoiding lap marks. Door and frame painting requires detailed brush work and careful masking to achieve clean lines and professional appearance. Window frame painting involves precise cutting-in around glazing and hardware, ensuring complete coverage while maintaining clean sight lines.",
            "price": "0.00",
            "extra_info": null
        },
        {
            "id": "312d0dac-1660-4bf1-b6f4-3da2ac194c7e",
            "ref": "PRD-03B4C386",
            "name": "Interior Painting Prep Work",
            "description": "All surfaces receive appropriate preparation including cleaning, patching of nail holes and minor imperfections, light sanding of glossy surfaces, and dust removal prior to paint application. Previously painted surfaces are evaluated for adhesion and compatibility with new coating systems. New drywall surfaces receive proper priming to ensure uniform paint absorption and appearance. Wood surfaces including door frames and window trim receive appropriate primer systems to prevent bleed-through and ensure proper topcoat adhesion. All preparation work is included in the labor rates ranging from $1.45 per square foot for standard surfaces.",
            "price": "0.00",
            "extra_info": null
        },
        {
            "id": "a99c7ba9-d813-4ca0-9277-9726b1619336",
            "ref": "PRD-293E1B78",
            "name": "Paint the Garage Door",
            "description": "Gel stain (mahogany tone)  Base coat (tan/light brown)  Clear protective topcoat (UV resistant)  Brushes / pads / tape",
            "price": "1000.00",
            "extra_info": null
        },
        {
            "id": "ea56c1b0-ee53-41a0-b2e0-8694a33a7b27",
            "ref": "PRD-E8E2EC8A",
            "name": "Finish Carpentry Scope of Work",
            "description": "This division encompasses all interior finish carpentry and millwork installation for the Erik & Alexis Dirkmaat Residence, including architectural trim, built-in cabinetry, stair components, and countertop installation. The scope covers 1,005 linear feet of base molding, 460 linear feet of crown molding, 48 door casing sets, 26 window stool and apron assemblies, complete stair system with 40 oak treads and 39 painted MDF risers, 56 linear feet of base cabinetry with 28 linear feet of upper cabinets, 52 linear feet of laminate countertops, and 94 linear feet of wall-mounted wood handrail. All work is executed per architectural drawings at 3/32\" = 1'-0\" scale across sheets 1/9 through 19/19.",
            "price": "0.00",
            "extra_info": null
        },
        {
            "id": "c9bd13ed-665e-4b95-ac1c-ed566cc176a1",
            "ref": "PRD-B6649604",
            "name": "Finish Carpentry Materials",
            "description": "This division encompasses all interior finish carpentry and millwork installation for the Erik & Alexis Dirkmaat Residence, including architectural trim, built-in cabinetry, stair components, and countertop installation. The scope covers 1,005 linear feet of base molding, 460 linear feet of crown molding, 48 door casing sets, 26 window stool and apron assemblies, complete stair system with 40 oak treads and 39 painted MDF risers, 56 linear feet of base cabinetry with 28 linear feet of upper cabinets, 52 linear feet of laminate countertops, and 94 linear feet of wall-mounted wood handrail. All work is executed per architectural drawings at 3/32\" = 1'-0\" scale across sheets 1/9 through 19/19. All of the Materials will be Provided by the Pine Valley Home Solution",
            "price": "0.00",
            "extra_info": null
        },
        {
            "id": "3a6b594e-de36-4668-bbf5-97f0ad3d99f0",
            "ref": "PRD-1C287F29",
            "name": "Finish Carpentry Installation Process",
            "description": "Installation methodology follows standard finish carpentry practices with 10% material wastage for linear molding items and 5% for discrete components. Base molding installation accounts for room perimeter minus 3 linear feet deduction per door opening, totaling 1,106 linear feet with wastage. Crown molding follows ceiling perimeter of applicable rooms, totaling 506 linear feet with wastage. Door casing installation covers both sides of every interior door leaf, requiring 50 sets with wastage. Cabinet installation includes proper shimming, leveling, and securing to structural elements, with countertop installation following cabinet completion. Stair component installation requires precise fitting and code-compliant construction with oak treads providing durable wearing surface over painted MDF risers.",
            "price": "0.00",
            "extra_info": null
        },
        {
            "id": "4b3f9113-d1b2-4f26-b5d2-8fcc10b4c8b2",
            "ref": "PRD-240089F5",
            "name": "One Year Workmanship Warranty",
            "description": "What is covered:  Peeling, blistering, or flaking paint due to improper application Defects in workmanship (painting, finish carpentry, wallpaper installation) Touch-ups required due to installation errors  What is NOT covered:  Normal wear and tear Damage caused by weather, moisture, or structural issues Cracks due to settling or movement Damage from other contractors or homeowner actions Fading or discoloration over time  Warranty Terms:  Customer must notify Bethel Stone LLC within the 1-year period We will inspect and repair affected areas at no cost if covered This warranty is non-transferable",
            "price": "0.00",
            "extra_info": null
        },
        {
            "id": "044220b1-aa7f-4966-9930-d03d225366c8",
            "ref": "PRD-756371C9",
            "name": "Exterior Doors Painting",
            "description": "The three red doors (front and side plus storm door) will be painted. Customer to confirm the collors.",
            "price": "0.00",
            "extra_info": null
        },
        {
            "id": "ac5fd629-1936-46a1-96a8-da23b2cafec2",
            "ref": "PRD-0B5F15DB",
            "name": "Brush Only Painting",
            "description": "Brush-only application for the entire project would increase the total cost by approximately 15%–30% due to additional labor time and slower production. For a 2,500 sq ft house, this typically adds about $1,500 to $3,600 depending on surface condition, trim detail, and number of coats.",
            "price": "4000.00",
            "extra_info": null
        },
        {
            "id": "2a521fc6-4a39-4d55-8622-1bd769ec09b1",
            "ref": "PRD-5AC38C1D",
            "name": "Supervision of the Work",
            "description": "Bethel Stone LLC will provide professional supervision throughout the duration of the project to ensure quality, efficiency, and adherence to industry standards.  Scope of Supervision Includes:  On-site project oversight by a qualified supervisor Coordination of crew and daily workflow Quality control inspections during each phase (prep, application, final) Ensuring proper surface preparation and paint application methods Compliance with safety standards and job site cleanliness Communication with the homeowner regarding progress and updates  Value to the Client:  Consistent high-quality workmanship Timely completion of the project Immediate resolution of any issues or concerns Professional accountability from start to finish",
            "price": "0.00",
            "extra_info": null
        },
        {
            "id": "30b90516-e530-4721-a468-45ddeac26271",
            "ref": "PRD-61FC17E5",
            "name": "Exterior Painting Scope of Work",
            "description": "We Propose to Paint House 240 Silver Lane, Limerick, ME,  The color will be all White. no Carpentry attached to this project.",
            "price": "0.00",
            "extra_info": null
        },
        {
            "id": "22095d7c-71c7-4b5d-97b0-468efa025782",
            "ref": "PRD-14FC8BC5",
            "name": "Carpentry Work",
            "description": "Baseboard Installation Install new baseboards throughout hallway/room and entry area.  Cope/miter inside and outside corners.  Scribe where walls/floors are uneven.  Nail, wood fill, caulk top edge, prep for paint.",
            "price": "0.00",
            "extra_info": null
        },
        {
            "id": "7551f0a0-f44b-4105-a8b7-bdec11edd71b",
            "ref": "PRD-9683BADC",
            "name": "Metal Board  Batten Siding",
            "description": "Scope of Work This division encompasses the complete exterior cladding system for the Saylor Farmhouse, a three-story residential structure located at 46 Cunningham Road. The scope includes installation of 2,304 square feet of mixed siding materials, comprising fiber cement lap siding (HardiePlank) covering 1,840 square feet as the primary exterior finish, and board & batten fiber cement siding covering 464 square feet as accent cladding. The work includes weather barrier installation across 2,304 square feet, corner trim installation totaling 120 linear feet, soffit installation covering 320 square feet, fascia board installation spanning 160 linear feet, and comprehensive caulking and sealant application. The total division cost is $18,819 before markups.",
            "price": "0.00",
            "extra_info": null
        },
        {
            "id": "3263cf35-6823-4e0d-ab7b-d5906aac5a78",
            "ref": "PRD-3EA466DE",
            "name": "Materials for the Project",
            "description": "",
            "price": "0.00",
            "extra_info": null
        },
        {
            "id": "4b8181a4-8089-47e3-837a-41b93a4b2e8a",
            "ref": "PRD-EEC374C4",
            "name": "Deck Repair",
            "description": "",
            "price": "0.00",
            "extra_info": null
        }
]
"""

def push_all_products():
    import json
    data = json.loads(user_input_json)
    
    # We remove the 'id' from JSON to let Supabase generate new UUIDs, 
    # and we add the correct user_id.
    final_payload = []
    for p in data:
        final_payload.append({
            "user_id": USER_ID,
            "ref": p["ref"],
            "name": p["name"],
            "description": p["description"],
            "price": float(p["price"]),
            "extra_info": p.get("extra_info")
        })
    
    # Post in chunks if possible, or all at once if small
    url = f"{SUPABASE_URL}/rest/v1/products"
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    
    # Chunking to avoid large payload errors
    chunk_size = 10
    for i in range(0, len(final_payload), chunk_size):
        chunk = final_payload[i:i + chunk_size]
        req = urllib.request.Request(url, data=json.dumps(chunk).encode('utf-8'), method='POST', headers=headers)
        try:
            with urllib.request.urlopen(req) as resp:
                print(f" ✅ Pushed chunk {i//chunk_size + 1}")
        except Exception as e:
            print(f" ❌ Error pushing chunk {i//chunk_size + 1}: {e}")

if __name__ == "__main__":
    push_all_products()
